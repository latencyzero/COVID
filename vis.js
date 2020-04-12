function
loadData()
{
	let promises = []
	promises.push(fetchJHU("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv"))
	promises.push(fetchJHU("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv"))
	promises.push(fetchCountryMap("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/UID_ISO_FIPS_LookUp_Table.csv"))
	promises.push(fetchWorldPopulation("https://latencyzero.github.io/COVID/populations.csv"))
	promises.push(fetchCOVID("https://covidtracking.com/api/v1/states/daily.json"))
	promises.push(fetchUSStatePopulation("https://latencyzero.github.io/COVID/us-state-populations.csv"))
	
	Promise.all(promises).then(
		function()
		{
// 			console.log("Data fetched")
			
			const confirmed = arguments[0][0]
			const deaths = arguments[0][1]
// 			const regions = arguments[0][2]["value"]
			const countryMap = arguments[0][2]
			const populations = arguments[0][3]
			const states = arguments[0][4]
			const statePopulations = arguments[0][5]
			
// 			console.log("Confirmed: " + arguments[0][0].length)
// 			console.log("Deaths: " + arguments[0][1].length)
// 			console.log("Recovered: " + arguments[0][2].length)

			processData(confirmed, deaths, countryMap, populations, states, statePopulations)
		},
		function (err)
		{
			console.log("Error fetching CSV data: " + err)
		}
	)
}

function
fetchCOVID(inURL)
{
	return d3.json(inURL)
}

function
fetchJHU(inURL)
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
						keys.splice(0, 4)
						let counts = []
						keys.forEach(key => { counts.push(parseInt(d[key])) })
						
						let country = d["Country/Region"].trim()
						
						let od = { country: country, counts: counts }
						let state = d["Province/State"].trim()
						if (state)
						{
							od["state"] = state
							od["full"] = country + " - " + state
						}
						else
						{
							od["full"] = country
						}
						return od
					})
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
						const od = { cskey: key, uid: uid, iso3: iso3 }
						return od
					})
}

function
fetchWorldPopulation(inURL)
{
	return d3.csv(inURL,
					function(d)
					{
						let isoCode = d["Country Code"].trim()
						let pop = parseInt(d["population"].trim())
						const od = { iso3: isoCode, population: pop }
						return od
					})
}

function
fetchUSStatePopulation(inURL)
{
	return d3.csv(inURL)
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
processData(inConfirmed, inDeaths, inCountryMap, inPopulations, inStates, inStatePopulations)
{
// 	console.log("Confirmed: " + inConfirmed.length)
// 	console.log(inConfirmed[0])
// 	console.log("Countries: " + inCountries.length)
// 	console.log("Populations: " + inPopulations.length)
	
	//	Break out states data into individual arrays per state…
	
	let states = {};
	inStates.forEach(sd =>
	{
		//	Get the date as a Date…
		
		let ds = "" + sd.date
		let date = new Date(ds.slice(0, 4) + "-" + ds.slice(4, 6) + "-" + ds.slice(6, 8))
		
		//	Get the state…
		
		let state = states[sd.state]
		if (!state)
		{
			let fs = inStatePopulations.find(s => s.state == sd.state)
			if (!fs)
			{
				return
			}
			
			let pop = fs.population
			state =
			{
				state: sd.state,
				full: sd.state,
				dates: [],
				confirmed: [],
				deaths: [],
				firstDate: date,
				latestConfirmed: sd.positive,
				latestDeaths: sd.death,
				population: pop
			}
			states[sd.state] = state
		}
		
		//	Update the earliest date…
		
		if (date < state.firstDate)
		{
			state.firstDate = date
			
		}
		
		//	Push the current data onto the front of the dates array…
		
		state.dates.unshift(date)
		state.confirmed.unshift(sd.positive || 0)
		state.deaths.unshift(sd.death || 0)
	})
	
	gStates = states
// 	for (let [k, s] of Object.entries(states))
// 	{
// 		console.log(s.state + ": " + s.confirmed.length + ", " + s.firstDate)
// 		s.confirmed.forEach(c =>
// 		{
// 			console.log("  " + c.date + ": " + c.count)
// 		})
// 	}
	
	//	Update the states menu…
	
	let statesSel = document.getElementById("states")
	if (statesSel)
	{
		for (let [k, s] of Object.entries(states))
		{
			let opt = document.createElement("option")
			opt.value = s.state
			opt.textContent = s.state + " (cases: " + s.latestConfirmed + ", deaths: " + s.latestDeaths + (s.population ? ", pop: " + s.population + ")" : ")")
			statesSel.appendChild(opt)
		}
	}
	
	//	Build regions list from confirmed cases…
	
	let regions =
		inConfirmed.map(e =>
		{
			const region = { country: e.country, state: e.state, full: e.full }
			return region
		})
	regions.sort((a, b) => { a.full.localeCompare(b.full) })
	
	//	Build maps from region to stats…
	
	let confirmed = new Map()
	inConfirmed.forEach(
		e => {
			confirmed.set(e.full, e.counts)
		})
	
	let deaths = new Map()
	inDeaths.forEach(
		e => {
			deaths.set(e.full, e.counts)
		})
	
	regions.forEach(r =>
		{
			let c = confirmed.get(r.full)
			let d = deaths.get(r.full)
			r.confirmed = c
			r.deaths = d
			r.latestConfirmed = Math.max(...c)
			r.latestDeaths = Math.max(...d)
		})
	
	//	Build a list of dates spanning the data,
	//	using an arbitrary region’s confirmed cases…
	
	for (let i = 0; i < regions[0].confirmed.length; ++i)
	{
		let d = new Date(2020, 0, 22)
		d.setDate(d.getDate() + i)
		gDates.push(d)
	}
	
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
		r.latestConfirmed = Math.max(...r.confirmed)
		r.latestDeaths = Math.max(...r.deaths)
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
	})
	regions.forEach((r, idx) => { r["id"] = idx })
	
	gRegions = regions
	
	//	Update the regions menu…
	
	let regionSel = document.getElementById("regions")
	regions.forEach(
		(r, k) => {
			let opt = document.createElement("option")
			opt.value = r.id
			opt.textContent = r.full + " (cases: " + r.latestConfirmed + ", deaths: " + r.latestDeaths + (r.population ? ", pop: " + r.population + ")" : ")")
			regionSel.appendChild(opt)
		})
	
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
	})
	filters.push({
		name: "Top 10 Countries by Deaths",
		id: 1,
		filter: function(inRegions)
		{
			let results = inRegions.filter(f => !f.state)
			results = results.sort((a, b) => b.latestDeaths - a.latestDeaths).slice(0, 10)
			return results
		}
	})
	gFilters = filters
	
	let filtersSel = document.getElementById("filters")
	filters.forEach(
		(f) => {
			let opt = document.createElement("option")
			opt.value = f.id
			opt.textContent = f.name
			filtersSel.appendChild(opt)
		})
	
	//	Create the main chart…
	
	gChartCases = createChart("cases", "Cases")
	gChartCasesPerCapita = createChart("casesPerCapita", "Cases per Capita", ",.2%")
	gChartDailyCases = createChart("dailyCases", "New Cases per Day")
	gChartDeaths = createChart("deaths", "Deaths")
	gChartDeathPercentages = createChart("deathPercentages", "Deaths as a Percentage of Cases", ",.0%", ",.1%")
	
	gAllCharts =
	[
		gChartCases,
		gChartCasesPerCapita,
		gChartDailyCases,
		gChartDeaths,
		gChartDeathPercentages,
	]
	
// 	setupDateSlider()
// 	loadDefaultData()
}

function
loadDefaultData()
{
	//	Load some default data, after a delay to let
	//	the charts show up…
	
	setTimeout(function()
	{
		addRegionsByFilterID(1)
		
		//	Iran has some outlier data and shows up on the top 10 list, so
		//	suppress it by default in the deaths/cases chart…
		
		let iran = getRegionByName("Iran")
		gChartDeathPercentages.toggle("d" + iran.id)
	 }, 10)
	
}

function
setupDateSlider()
{
	let minMinDate = new Date(2020, 0, 22)
	let maxMinDate = new Date()
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

var gRegions
var gFilters
var gSelectedRegions = new Set()

var gStates
var gSelectedStates = new Set()

var	gDates = []

var gChartCases
var gChartCasesPerCapita
var gChartDailyCases
var gChartDeaths
var gChartDeathPercentages

var gAllCharts = []

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
computeStateDeathsPerCases(ioState)
{
	if (ioState.deathsPerCases)
	{
		return
	}
	
	let deaths = []
	ioState.deaths.forEach(
		(d, i) =>
		{
			deaths.push(d / ioState.confirmed[i])
		})
	
	ioState.deathsPerCases = deaths
}

function
getRegionByID(inID)
{
	return gRegions[inID]
}

function
getRegionByName(inName)
{
	return gRegions.find(r => r.full == inName)
}

function
createChart(inElementID, inYAxisLabel, inYFormat, inLegendDataFormat)
{
	let legendFormat = inLegendDataFormat || inYFormat
	let opts = {
		bindto: "#" + inElementID,
		data:
		{
// 			x: "x",
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
						return inYFormat ? d3.format(legendFormat)(inV) : inV
					}
			}
		},
		zoom: { enabled: true }
	}
	let chart = c3.generate(opts)
	
	return chart
}

function
addRegionByID(inRegionID)
{
	let region = getRegionByID(inRegionID)
	addRegions(region)
}

function
addRegions(inRegions)
{
	let regions = inRegions instanceof Array ? inRegions : [inRegions]
	//TODO: check against gSelectedRegions
	regions = regions.filter(r => !gSelectedRegions.has(r))
	
	//	Compute derived data…
	
	regions.forEach(r =>
	{
		addRegionTag(r.id, 1)
		computeDailyCases(r)
		computePerCapita(r)
		computeDeathsPerCases(r)
	
		//	Keep track of this newly-added region…
	
		gSelectedRegions.add(r)
	})
	
	//	Load the charts with data…
	
	let dates = ["x"].concat(gDates)
	loadRegionChart(gChartCases, dates, regions, "confirmed")
	loadRegionChart(gChartCasesPerCapita, dates, regions, "perCapitaConfirmed")
	loadRegionChart(gChartDailyCases, dates, regions, "dailyConfirmed")
	loadRegionChart(gChartDeaths, dates, regions, "deaths")
	loadRegionChart(gChartDeathPercentages, dates, regions, "deathsPerCases")
}

function
addStateByID(inStateID)
{
	let state = gStates[inStateID]
	addStates(state)
}

function
addStates(inStates)
{
	let states = inStates instanceof Array ? inStates : [inStates]
	//TODO: check against gSelectedRegions
	states = states.filter(r => !gSelectedRegions.has(r))
	
	//	Compute derived data…
	
	states.forEach(s =>
	{
// 		addStateTag(s.state, 1)
		computeDailyCases(s)
		computePerCapita(s)
		computeStateDeathsPerCases(s)
	
		//	Keep track of this newly-added region…
	
		gSelectedStates.add(s)
	})
	
	//	Load the charts with data…
	
	loadStateChart(gChartCases, states, "confirmed")
	loadStateChart(gChartCasesPerCapita, states, "perCapitaConfirmed")
	loadStateChart(gChartDailyCases, states, "dailyConfirmed")
	loadStateChart(gChartDeaths, states, "deaths")
	loadStateChart(gChartDeathPercentages, states, "deathsPerCases")
}



function
loadRegionChart(inChart, inDates, inRegions, inData, inDone)
{
	let regions = inRegions instanceof Array ? inRegions : [inRegions]
//	let columns = regions.map(r => ["x" + r.id].concat(r["dates"]))
	let columns = regions.map(r => ["x" + r.id].concat(gDates))

	columns = columns.concat(regions.map(r => ["d" + r.id].concat(r[inData])))
	let names = {}
	let xs = {}
	regions.forEach(r =>
	{
		let id = "d" + r.id
		names[id] = r.full
		xs[id] = "x" + r.id
	})
	
	let data = {
		type: "line",
		xs: xs,
		columns: columns,
		names: names,
		done: inDone
	}
	inChart.load(data)
}

function
loadStateChart(inChart, inStates, inData, inDone)
{
	let states = inStates instanceof Array ? inStates : [inStates]
	states = states.filter(s => s[inData])		//	Exclude states that don't have the requested data
	let columns = states.map(s => ["x" + s.state].concat(s["dates"]))
	columns = columns.concat(states.map(s => ["d" + s.state].concat(s[inData])))
	let names = {}
	let xs = {}
	states.forEach(s =>
	{
		let id = "d" + s.state
		names[id] = s.state
		xs[id] = "x" + s.state
	})
	
	let data = {
		type: "line",
		xs: xs,
		columns: columns,
		names: names,
		done: inDone
	}
	inChart.load(data)
}

function
addRegionsByFilterID(inFilterID)
{
// 	setTimeout(function()
// 	{
		let filter = gFilters.find(f => f.id == inFilterID)
		let regions = filter.filter(gRegions)
		addRegions(regions)
// 		regions.forEach(r => addRegions(r))
// 	}, 10)
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
				.attr("onclick", "removeRegion(" + inRegionID + ", " + inChartID + ")")
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
	let inc
	if (inMax < 1000) inc = 100
	else if (inMax < 10000) inc = 1000
	else if (inMax < 100000) inc = 10000
	else if (inMax < 1000000) inc = 100000
	else inc = 1000000
	
	return Math.ceil(inMax / inc) * inc
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

