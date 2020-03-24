function
loadData()
{
	var promises = [];
	promises.push(fetchCOVID("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv"));
	promises.push(fetchCOVID("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv"));
// 	promises.push(fetch("https://ghoapi.azureedge.net/api/DIMENSION/COUNTRY/DimensionValues").then((response) => { return response.json(); }));
	promises.push(fetchPopulation("https://latencyzero.github.io/COVID/populations.csv"));
	
	Promise.all(promises).then(
		function()
		{
			console.log("Data fetched");
			
			var confirmed = arguments[0][0];
			var deaths = arguments[0][1];
// 			var regions = arguments[0][2]["value"];
			var populations = arguments[0][2];
			
// 			console.log("Confirmed: " + arguments[0][0].length);
// 			console.log("Deaths: " + arguments[0][1].length);
// 			console.log("Recovered: " + arguments[0][2].length);

			processData(confirmed, deaths, populations)
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
						
						var keys = Object.keys(d)
						keys.splice(0, 4);
						var counts = [];
						keys.forEach(function(key)
							{
								counts.push(d[key]);
							});
						
						var country = d["Country/Region"].trim();
						if (country == "US") country = "United States";		//	Fix up country names
						
						var od = { country: country, counts: counts };
						var state = d["Province/State"].trim();
						if (state) od["state"] = state;
						return od;
					});
}

function
fetchPopulation(inURL)
{
	return d3.csv(inURL,
					function(d)
					{
						var name = d["Country Name"].trim();
						
						//	Find the latest population year…
						
						var pop = 0;
						var year = 0;
						for (var i = 2020; i >= 1960; --i)
						{
							var s = d[i];
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
						var od = { name: name, population: pop, year: year };
						return od;
					});
}

function
processData(inConfirmed, inDeaths, inPopulations)
{
	console.log("Confirmed: " + inConfirmed.length);
	console.log(inConfirmed[0]);
// 	console.log("Countries: " + inCountries.length);
	console.log("Populations: " + inPopulations.length);
	
	//	Build maps from region to stats…
	
	var confirmed = new Map();
	inConfirmed.forEach(
		e => {
			confirmed.set(e.country, e.counts);
		});
	
	var confirmedRegions = new Set(confirmed.keys());
	
	var deaths = new Map()
	inDeaths.forEach(
		e => {
			deaths.set(e.country, e.counts);
		});
	
	var regions = new Map();
	inPopulations.sort((a, b) => {
		return a.name.localeCompare(b.name)
	});
	inPopulations
		.filter(e => confirmedRegions.has(e.name))							//	Only include those in COVID stats
		.forEach(
		e => {
			regions.set(e.name, { name: e.name, population: e.population, year: e.year });
		});
		
	gConfirmed = confirmed;
	gDeaths = deaths;
	gRegions = regions;
	
	//	Update the regions menu…
	
	let regionSel = document.getElementById("regions");
	regions.forEach(
		(v, k) => {
			let opt = document.createElement("option");
			opt.value = k;
			opt.textContent = v.name;
			regionSel.appendChild(opt);
		});
		
	addRegion("United States");
}

function
addRegion(inRegion)
{
	console.log(inRegion);
	
	nv.addGraph(
		function()
		{
			var chart = nv.models.lineChart()
						.options({
							duration: 15,
							useInteractiveGuideline: true
						});
			
			chart.xAxis
				.axisLabel("Date");
			
			chart.yAxis
				.axisLabel("Cases");
			
			let confirmed = gConfirmed.get(inRegion);
			
			var data = [
							{
								values: confirmed.counts
							}
						];
			
			d3.select("#chart1").append("svg")
				.datum(data)
				.call(chart);
				
			return chart;
		});
}

var gConfirmed;
var gDeaths;
var gRegions;
var gSelectedRegions;
