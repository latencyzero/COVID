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
								counts.push(parseInt(d[key]));
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

var gChart;
var data;

function
addRegion(inRegion)
{
	console.log(inRegion);
	
	nv.addGraph(
		function()
		{
			gChart = nv.models.linePlusBarChart()
						.options({
							duration: 15,
							useInteractiveGuideline: true
						});
						
			gChart.showLegend(true)
					.focusEnable(false)
					.margin({left: 80, right: 50})
// 					.height(400);
			
			gChart.xAxis
				.axisLabel("Date")
				.tickFormat(function(d) { return d3.time.format("%d-%b-%y")(new Date(d)); });
			gChart.xScale(d3.time.scale());
			
			gChart.y1Axis
				.axisLabel("Cases");
			
			gChart.y2Axis
				.axisLabel("New Cases");
			
			gChart.bars.forceY([0]);
			
			let confirmed = gConfirmed.get(inRegion);
			let deaths = gDeaths.get(inRegion);
			
			let newConfirmed = confirmed.map((e, idx) =>
				{
					var last = idx == 0 ? 0 : confirmed[idx - 1];
					return e - last;
				});
				
			let max = Math.max(...confirmed);
			gChart
// 				.yScale(d3.scale.log())
				.yDomain([0, chartMax(max)]);
			
			let covidSeriesMap = (e, idx) =>
			{
				var d = new Date(2020, 0, 22);
				d.setDate(d.getDate() + idx);
				return { x: d, y: e };
			}
			
			var data = [
							{
								key: "Confirmed", values: confirmed.map(covidSeriesMap), color: "#00ff00"
							},
							{
								key: "New Confirmed", values: newConfirmed.map(covidSeriesMap), color: "#ccccff", bar: true
							},
							{
								key: "Deaths", values: deaths.map(covidSeriesMap), color: "#ff0000"
							}
						];
// 			var data = sinAndCos();
			
			d3.select("#chart1").append("svg")
				.datum(data)
				.transition()
				.duration(0)
				.call(gChart);
			
			nv.utils.windowResize(function() { gChart.update() });
			return gChart;
		});
}

var gConfirmed;
var gDeaths;
var gRegions;
var gSelectedRegions;


/**
	Returns a maximum value somewhat larger than inMax.
*/

function
chartMax(inMax)
{
	var inc;
	if (inMax < 1000) inc = 100;
	else if (inMax < 10000) inc = 1000;
	else if (inMax < 100000) inc = 10000;
	else if (inMax < 1000000) inc = 100000;
	else inc = 1000000;
	
	return Math.ceil(inMax / inc) * inc;
}

//     var chart;
//     var data;
//     var legendPosition = "top";
// 
//     var randomizeFillOpacity = function() {
//         var rand = Math.random(0,1);
//         for (var i = 0; i < 100; i++) { // modify sine amplitude
//             data[4].values[i].y = Math.sin(i/(5 + rand)) * .4 * rand - .25;
//         }
//         data[4].fillOpacity = rand;
//         chart.update();
//     };
// 
//     var toggleLegend = function() {
//         if (legendPosition == "top") {
//             legendPosition = "bottom";
//         } else {
//             legendPosition = "top";
//         }
//         chart.legendPosition(legendPosition);
//         chart.update();
//     };
// 
//     nv.addGraph(function() {
//         chart = nv.models.lineChart()
//             .options({
//                 duration: 300,
//                 useInteractiveGuideline: true
//             })
//         ;
// 
//         // chart sub-models (ie. xAxis, yAxis, etc) when accessed directly, return themselves, not the parent chart, so need to chain separately
//         chart.xAxis
//             .axisLabel("Time (s)")
//             .tickFormat(d3.format(',.1f'))
//             .staggerLabels(true)
//         ;
// 
//         chart.yAxis
//             .axisLabel('Voltage (v)')
//             .tickFormat(function(d) {
//                 if (d == null) {
//                     return 'N/A';
//                 }
//                 return d3.format(',.2f')(d);
//             })
//         ;
// 
//         data = sinAndCos();
// 
//         d3.select('#chart1').append('svg')
//             .datum(data)
//             .call(chart);
// 
//         nv.utils.windowResize(chart.update);
// 
//         return chart;
//     });

    function sinAndCos() {
        var sin = [],
            sin2 = [],
            cos = [],
            rand = [],
            rand2 = []
            ;

        for (var i = 0; i < 100; i++) {
            sin.push({x: i, y: i % 10 == 5 ? null : Math.sin(i/10) }); //the nulls are to show how defined works
            sin2.push({x: i, y: Math.sin(i/5) * 0.4 - 0.25});
            cos.push({x: i, y: .5 * Math.cos(i/10)});
            rand.push({x:i, y: Math.random() / 10});
            rand2.push({x: i, y: Math.cos(i/10) + Math.random() / 10 })
        }

        return [
            {
                area: true,
                values: sin,
                key: "Sine Wave",
                color: "#ff7f0e",
                strokeWidth: 4,
                classed: 'dashed'
            },
            {
                values: cos,
                key: "Cosine Wave",
                color: "#2ca02c"
            },
            {
                values: rand,
                key: "Random Points",
                color: "#2222ff"
            },
            {
                values: rand2,
                key: "Random Cosine",
                color: "#667711",
                strokeWidth: 3.5
            },
            {
                area: true,
                values: sin2,
                key: "Fill opacity",
                color: "#EF9CFB",
                fillOpacity: .1
            }
        ];
    }
