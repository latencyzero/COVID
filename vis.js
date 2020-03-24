function
loadData()
{
	var promises = [];
	promises.push(fetchCOVID("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv"));
	promises.push(fetchCOVID("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv"));
// 	promises.push(fetch("https://ghoapi.azureedge.net/api/DIMENSION/COUNTRY/DimensionValues").then((response) => { return response.json(); }));
	promises.push(fetchPopulation("populations.csv"));
	
	Promise.all(promises).then(
		function()
		{
			console.log("Data fetched");
			
			var confirmed = arguments[0][0];
			var deaths = arguments[0][1];
			var regions = arguments[0][2]["value"];
			var populations = arguments[0][3];
			
// 			console.log("Confirmed: " + arguments[0][0].length);
// 			console.log("Deaths: " + arguments[0][1].length);
// 			console.log("Recovered: " + arguments[0][2].length);

			processData(confirmed, deaths, regions, populations)
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
						var state = d["Province/State"].trim();
						if (state.length > 0)						//	Skip if the state is empty
							return;
						
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
						var od = { country: country, counts: counts };
						return od;
					});
}

function
fetchPopulation(inURL)
{
	return d3.csv(inURL,
					function(d)
					{
						var country = d["Country Name"].trim();
						var pop = d["2019"].trim();
						var od = { country: country, population: pop };
						return od;
					});
}

function
processData(inConfirmed, inDeaths, inCountries, inPopulations)
{
	console.log("Data: " + inConfirmed.length);
	console.log(inConfirmed[0]);
	console.log("Countries: " + inCountries.length);
// 	console.log("Populations: " + inPopulations.length);
	
	//	Build maps from region to stats…
	
	var regions = new Object();
	
	var regions = new Set()
	inConfirmed.forEach(
		function(e)
		{
		}
	);
}

