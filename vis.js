function
loadData()
{
	let promises = [];
	promises.push(fetchCOVID("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv"))
	promises.push(fetchCOVID("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv"))
	promises.push(fetchCountryMap("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/UID_ISO_FIPS_LookUp_Table.csv"))
// 	promises.push(fetch("https://ghoapi.azureedge.net/api/DIMENSION/COUNTRY/DimensionValues").then((response) => { return response.json(); }))
	promises.push(fetchPopulation("https://latencyzero.github.io/COVID/populations.csv"))
	
	Promise.all(promises).then(
		function()
		{
// 			console.log("Data fetched");
			
			const confirmed = arguments[0][0];
			const deaths = arguments[0][1];
// 			const regions = arguments[0][2]["value"];
			const countryMap = arguments[0][2];
			const populations = arguments[0][3];
			
// 			console.log("Confirmed: " + arguments[0][0].length);
// 			console.log("Deaths: " + arguments[0][1].length);
// 			console.log("Recovered: " + arguments[0][2].length);

			processData(confirmed, deaths, countryMap, populations)
		},
		function (err)
		{
			console.log("Error fetching CSV data: " + err);
		}
	);
}

function
fetchCOVID(inURL)
{
	return d3.csv(inURL,
					function(d)
					{
						//	Convert the count/day columns into an array. This
						//	is very fragile, and depends right now on the
						//	column headers (mm/dd/yy) to be sorted properly….
						//	The Javascript Object does seem to keep the keys
						//	in order, but this could break.
						
						let keys = Object.keys(d)
						keys.splice(0, 4);
						let counts = [];
						keys.forEach(key => { counts.push(parseInt(d[key])); });
						
						let country = d["Country/Region"].trim();
						
						let od = { country: country, counts: counts };
						let state = d["Province/State"].trim();
						if (state)
						{
							od["state"] = state;
							od["full"] = country + " - " + state;
						}
						else
						{
							od["full"] = country
						}
						return od;
					});
}

function
fetchCountryMap(inURL)
{
	return d3.csv(inURL,
					function(d)
					{
						let country = d["Country_Region"].trim()
						const state = d["Province_State"].trim()
						const uid = parseInt(d["UID"].trim())
						const iso3 = d["iso3"]
						const key = state ? country + "-" + state : country
						const od = { cskey: key, uid: uid, iso3: iso3 };
						return od;
					});
}

function
fetchPopulation(inURL)
{
	return d3.csv(inURL,
					function(d)
					{
						let isoCode = d["Country Code"].trim();
						
						//	Find the latest population year…
						
						let pop = 0;
						let year = 0;
						for (let i = 2020; i >= 1960; --i)
						{
							const s = d[i];
							if (s)
							{
								pop = parseInt(s.trim());
								year = i;
								if (pop)
								{
									break;
								}
							}
						}
						const od = { iso3: isoCode, population: pop, year: year };
						return od;
					});
}

/**
	Post-process the data into structures suitable for our use.
	
	Region
		country
		state
		full
		confirmed
		deaths
		dailyConfirmed
		dailyDeaths
		perCapitaConfirmed
		perCapitaDeaths
		deathsPerCases
*/

function
processData(inConfirmed, inDeaths, inCountryMap, inPopulations)
{
// 	console.log("Confirmed: " + inConfirmed.length);
// 	console.log(inConfirmed[0]);
// 	console.log("Countries: " + inCountries.length);
// 	console.log("Populations: " + inPopulations.length);
	
	//	Build regions list from confirmed cases…
	
	let regions =
		inConfirmed.map(e =>
		{
			const region = { country: e.country, state: e.state, full: e.full }
			return region
		});
	regions.sort((a, b) => { a.full.localeCompare(b.full) });
	
	//	Build maps from region to stats…
	
	let confirmed = new Map();
	inConfirmed.forEach(
		e => {
			confirmed.set(e.full, e.counts);
		});
	
	let deaths = new Map()
	inDeaths.forEach(
		e => {
			deaths.set(e.full, e.counts);
		});
	
	regions.forEach(r =>
		{
			let c = confirmed.get(r.full);
			let d = deaths.get(r.full);
			r.confirmed = c;
			r.deaths = d;
			r.latestConfirmed = Math.max(...c);
			r.latestDeaths = Math.max(...d);
		});
	
	//	Build country map…
	
	let countryCodeMap = {}
	inCountryMap.forEach(cm =>
	{
		countryCodeMap[cm.cskey] = cm
	})
	
	//	Totals for regions with sub regions…
	
	let totalsRegions = {}
	let curTotal = null
	regions.forEach(r =>
	{
		if (r.state)
		{
			curTotal = totalsRegions[r.country]
			if (!curTotal)
			{
				curTotal = JSON.parse(JSON.stringify(r))		//	Deep-copy the region
				curTotal.state = null
				curTotal.full = curTotal.country
				totalsRegions[curTotal.country] = curTotal
			}
			else
			{
				curTotal.confirmed.forEach((s, i) => { curTotal.confirmed[i] += r.confirmed[i] })
				curTotal.deaths.forEach((s, i) => { curTotal.deaths[i] += r.deaths[i] })
				//	If the country matches, then sum the values…
				
				if (r.country == curTotal.country)
				{
				}
				else	//	We’re done with this country, start over
				{
					
// 					totalsRegions.push(curTotal)
					curTotal = null
				}
			}
		}
	})
	
	//	Get maximums…
	
	let tr = Object.values(totalsRegions)
	tr.forEach(r =>
	{
		r.latestConfirmed = Math.max(...r.confirmed);
		r.latestDeaths = Math.max(...r.deaths);
	})
	
	regions = tr.concat(regions)
	
	//	Build population map…
	
	let populationMap = {}
	inPopulations.forEach(p =>
	{
		populationMap[p.iso3] = p
	})
	
	//	Add ISO codes and populations to regions…
	
	regions.forEach(r =>
	{
		const key = r.state ? r.country + "-" + r.state : r.country
		const cm = countryCodeMap[key]
		if (cm)
		{
			r.iso3 = cm.iso3
			r.uid = cm.uid
			
			const pop = populationMap[r.iso3]
			if (pop)
			{
				r.population = pop.population
				r.popYear = pop.year
			}
		}
	})
	
	//	Group regions…
	
	regions.forEach(r => r.sequence = 999)
	
	//	Sort the regions…
	
	regions.sort((a, b) =>
	{
		if (a.sequence == b.sequence)
		{
			return a.full.localeCompare(b.full)
		}
		else
		{
			return Math.sign(b.sequence - a.sequence)
		}
	});
	regions.forEach((r, idx) => { r["id"] = idx });
	
	gRegions = regions;
	
	//	Update the regions menu…
	
	let regionSel = document.getElementById("regions");
	regions.forEach(
		(r, k) => {
			let opt = document.createElement("option");
			opt.value = r.id;
			opt.textContent = r.full + " (cases: " + r.latestConfirmed + ", deaths: " + r.latestDeaths + (r.population ? ", pop: " + r.population + ")" : ")")
			regionSel.appendChild(opt);
		});
	
	//	Populate filters…
	
	let filters = []
	filters.push({
		name: "Top 10 Countries by Cases",
		id: 1,
		filter: function(inRegions)
		{
			let results = inRegions.filter(f => !f.state)
			results = results.sort((a, b) => b.latestConfirmed - a.latestConfirmed).slice(0, 10)
			return results
		}
	});
	filters.push({
		name: "Top 10 Countries by Deaths",
		id: 1,
		filter: function(inRegions)
		{
			let results = inRegions.filter(f => !f.state)
			results = results.sort((a, b) => b.latestDeaths - a.latestDeaths).slice(0, 10)
			return results
		}
	});
	gFilters = filters
	
	let filtersSel = document.getElementById("filters");
	filters.forEach(
		(f) => {
			let opt = document.createElement("option");
			opt.value = f.id;
			opt.textContent = f.name;
			filtersSel.appendChild(opt);
		});
	
	//	Create the main chart…
	
	gChartCases = createChart("cases", "Cases")
	gChartCasesPerCapita = createChart("casesPerCapita", "Cases per Capita", ",.4%")
	gChartDailyCases = createChart("dailyCases", "New Cases per Day")
	gChartDeaths = createChart("deaths", "Deaths")
	gChartDeathPercentages = createChart("deathPercentages", "Deaths as a Percentage of Cases", ",.4%")
	
	gAllCharts =
	[
		gChartCases,
		gChartCasesPerCapita,
		gChartDailyCases,
		gChartDeaths,
		gChartDeathPercentages,
	]
	
	//	Load some default data…
	
	addRegionsByFilterID(1)
	
	//	Set up the minimum date slider…
	
	let minMinDate = new Date(2020, 0, 22)
	let maxMinDate = new Date();
	var slider = d3
		.sliderBottom()
		.min(minMinDate)
		.max(maxMinDate)
		.tickFormat(d3.timeFormat("%b-%d"))
		.step(1)
		.ticks(2)
		.width(700)
		.default([minMinDate, maxMinDate])
		.displayValue(true)
		.on('onchange',
			val =>
			{
				const min = val[0]
				const max = val[1]
				
				gAllCharts.forEach(c => c.axis.range({ min: { x : min }, max: { x : max } }))
			})

	d3.select('#minDate')
		.append('svg')
		.attr('width', 800)
		.attr('height', 100)
		.append('g')
		.attr('transform', 'translate(30,30)')
		.call(slider)
}

var gRegions;
var gFilters;
var gSelectedRegions = new Set();

var gChartCases;
var gChartCasesPerCapita;
var gChartDailyCases;
var gChartDeaths;
var gChartDeathPercentages;

var gAllCharts = [];

/**
	Computes the new cases for the specified region if needed.
*/

function
computeDailyCases(ioRegion)
{
	if (ioRegion.dailyConfirmed && ioRegion.dailyDeaths)
	{
		return
	}
	
	let dailyCases = []
	let dailyDeaths = []
	let lastCases = 0
	let lastDeaths = 0
	ioRegion.confirmed.forEach((c, i) =>
	{
		dailyCases.push(ioRegion.confirmed[i] - lastCases)
		dailyDeaths.push(ioRegion.deaths[i] - lastDeaths)
		
		lastCases = ioRegion.confirmed[i]
		lastDeaths = ioRegion.deaths[i]
	})
	
	ioRegion.dailyConfirmed = dailyCases
	ioRegion.dailyDeaths = dailyDeaths
}

function
computePerCapita(ioRegion)
{
	if (ioRegion.perCapitaConfirmed && ioRegion.perCapitaDeaths)
	{
		return
	}
	
	let cases = []
	let deaths = []
	ioRegion.confirmed.forEach((c, i) =>
	{
		cases.push(ioRegion.confirmed[i] / ioRegion.population)
		deaths.push(ioRegion.deaths[i] / ioRegion.population)
	})
	
	ioRegion.perCapitaConfirmed = cases
	ioRegion.perCapitaDeaths = deaths
}

function
computeDeathsPerCases(ioRegion)
{
	if (ioRegion.deathsPerCases)
	{
		return
	}
	
	let deaths = []
	ioRegion.deaths.forEach(
		(d, i) =>
		{
			deaths.push(d / ioRegion.confirmed[i])
		})
	
	ioRegion.deathsPerCases = deaths
}

function
getRegionByID(inID)
{
	return gRegions[inID];
}

function
getRegionByName(inName)
{
	return gRegions.find(r => r.full == inName);
}

function
createChart(inElementID, inYAxisLabel, inYFormat)
{
	let opts = {
		bindto: "#" + inElementID,
		data:
		{
			x: "x",
			columns: [],
			empty: { label : { text: "Loading…" } },
		},
		axis:
		{
			x:
			{
				label: { text: "Day", position: "outer-middle" },
				type: "timeseries",
				tick: { format: "%b-%d", values: [ new Date(2020, 0, 22), new Date(2020, 1, 1), new Date(2020, 1, 15), new Date(2020, 2, 1), new Date(2020, 2, 15), new Date(2020, 3, 1), new Date(2020, 3, 15), new Date(2020, 4, 1), new Date(2020, 4, 15), new Date(2020, 5, 1), new Date(2020, 5, 15) ] },
			},
			y: {
				label: { text: inYAxisLabel, position: "outer-middle" },
				tick: {
					format: inYFormat ? d3.format(inYFormat) : null
				}
			},
			y2: { show: false }
		},
		tooltip: {
			grouped: false,
			format: {
				value:
					function (inV, inRatio, inID)
					{
						return inYFormat ? d3.format(inYFormat)(inV) : inV
					}
			}
		}
	}
	let chart = c3.generate(opts)
// 	setTimeout(function() { chart.axis.min({x: new Date(2020, 2, 1)}) }, 5000)
	
	return chart
}

function
addRegionByID(inRegionID)
{
	setTimeout(function()
	{
		let region = getRegionByID(inRegionID)
		addRegion(region)
	}, 10);
}

function
addRegion(inRegion)
{
	if (gSelectedRegions.has(inRegion.id))
	{
// 		console.log("Skipping " + inRegion.country + ", already selected")
		return;
	}
	
// 	console.log(inRegion);
	addRegionTag(inRegion.id, 1);
	
	let confirmed = inRegion.confirmed;
	let deaths = inRegion.deaths;
	
	computeDailyCases(inRegion)
	computePerCapita(inRegion)
	computeDeathsPerCases(inRegion)
	
	//	Get the max value…
	
	let max = Math.max(...confirmed);
	
	//	Set dates…
	
	let regionDates = inRegion.confirmed.map((e, idx) =>
	{
		let d = new Date(2020, 0, 22);
		d.setDate(d.getDate() + idx);
		return d;
	})
	
	//	Load the charts with data…
	
	let dates = ["x"].concat(regionDates);
	loadChart(gChartCases, dates, inRegion, "confirmed")
	loadChart(gChartCasesPerCapita, dates, inRegion, "perCapitaConfirmed")
	loadChart(gChartDailyCases, dates, inRegion, "dailyConfirmed")
	loadChart(gChartDeaths, dates, inRegion, "deaths")
	loadChart(gChartDeathPercentages, dates, inRegion, "deathsPerCases")
	
	gSelectedRegions.add(inRegion.id)
}

function
loadChart(inChart, inDates, inRegion, inData)
{
	inChart.load({
		x: "x",
		columns:
		[
			inDates,
			["d" + inRegion.id].concat(inRegion[inData]),
		],
		type: "line",
		names:
		{
			["d" + inRegion.id] : inRegion.full,
		}
	});
}

function
addRegionsByFilterID(inFilterID)
{
	setTimeout(function()
	{
		let filter = gFilters.find(f => f.id == inFilterID)
		let regions = filter.filter(gRegions)
		regions.forEach(r => addRegion(r))
	}, 10);
}

function
addSeriesToChart(inChart)
{
}

function
removeAllRegions()
{
	gAllCharts.forEach(c => c.unload())
	
	gSelectedRegions.clear()
	removeAllRegionTags()
}

function
removeRegion(inRegionID, inChartID)
{
	removeRegionTag(inRegionID, inChartID)
	
	let region = getRegionByID(inRegionID)
	gAllCharts.forEach(c => c.unload({ ids: ["d" + region.id] }))
	
	gSelectedRegions.delete(inRegionID)
}

/**
	Adds a tag to the specified chart to give the user a way to remove regions.
*/

function
addRegionTag(inRegionID, inChartID)
{
	let region = getRegionByID(inRegionID)
	d3.select("#tags" + inChartID)
		.append("span")
			.attr("class", "region")
			.attr("id", "region" + inRegionID)
			.text(region.full + " (" + region.latestConfirmed + ", " + region.latestDeaths + ")")
			.append("a")
				.attr("class", "remove")
				.attr("onclick", "removeRegion(" + inRegionID + ", " + inChartID + ");")
				.text("×")
}

/**
	Remove the specified region tag from the specified chart.
*/

function
removeRegionTag(inRegionID, inChartID)
{
	d3.select("#tags" + inChartID)
		.select("#region" + inRegionID)
			.remove()
}

function
removeAllRegionTags()
{
	d3.select("#tags1")
		.selectAll("*")
			.remove()
}


/**
	Returns a maximum value somewhat larger than inMax.
*/

function
chartMax(inMax)
{
	let inc;
	if (inMax < 1000) inc = 100;
	else if (inMax < 10000) inc = 1000;
	else if (inMax < 100000) inc = 10000;
	else if (inMax < 1000000) inc = 100000;
	else inc = 1000000;
	
	return Math.ceil(inMax / inc) * inc;
}


// Copies a variable number of methods from source to target.
d3.rebind = function(target, source) {
  var i = 1, n = arguments.length, method;
  while (++i < n) target[method = arguments[i]] = d3_rebind(target, source, source[method]);
  return target;
};

// Method is assumed to be a standard D3 getter-setter:
// If passed with no arguments, gets the value.
// If passed with arguments, sets the value and returns the target.
function d3_rebind(target, source, method) {
  return function() {
	var value = method.apply(source, arguments);
	return value === source ? target : value;
  };
}

