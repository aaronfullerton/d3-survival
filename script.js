// Create a format function to transform our data
// so that it is usable in the survival analysis
var formatData = function(d) {
	// Declare our function's private variables
	var 
	format = 'MM/DD/YYYY',
	censored,
	endDate;

	// If the endpoint (death) has been met,
	// set the endDate to the deathDate
	// and set censored to false 
	if(moment(d.dateOfDeath, format).isValid()) {
		endDate = moment(d.dateOfDeath, format);
		censored = false;
	} else {
		// If the endpoint has not been met,
		// set the endDate to the date of last
		// followup and set censored to true
		endDate = moment(d.dateOfLastFU, format);
		censored = true;

		// Furthermore, if the date of last followup
		// is after February of this year, assume the
		// patient is still alive, and set the enddate
		// to the current date
		if(endDate.isAfter('02/01/2015', format)) {
			endDate = moment();
		}
	}

	//Now return our formatted data
	return {
		name: d.firstName + ' ' + d.lastName,
		startDate: moment(d.dateOfDx, format),
		endDate: endDate,
		birthDate: moment(d.dateOfBirth, format),
		censored: censored,
		include: d.include,
		transplant: d.transplant,
		sex: d.sex,
		mrn: d.MRN,
		timeToEndpoint: moment(endDate).diff(moment(d.dateOfDx, format), 'days'),
		age: moment(d.dateOfDx).diff(moment(d.dateOfBirth, format), 'years')
	}
}

// Use the function above to
// actually format the data
// then sort it
var patients = data.map(formatData).sort(function(a, b) {
	return a.timeToEndpoint - b.timeToEndpoint;
});

// Now that we have our data in a usable
// structure, let's start graphing

var createSurvivalChart = function(element, data) {

	// Set up our chart properties
	var margin = {top: 20, right: 20, bottom: 60, left: 60},
    width = 960 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

    // Create our x and y axes

	    // Our y axis is linear and extends from
	    // '0' to the height specified above
	    // since survival analysis is percentage
	    // based, we know the y axis will only
	    // include values between 0 and 100
	    var y = d3.scale.linear()
	    	.range([height, 0])
	    	.domain([0, 1]);

	    //SVGs consider Y = 0 to be the top. Need to invert
	    var invertY = d3.scale.linear()
	    	.range([height, 0])
	    	.domain([1, 0]);

	    // We don't know the extent of our values
	    // contained in the x direction, so we need
	    // to calculate that first
	    var xMax = d3.max(data, function(d) {
	    	return d.timeToEndpoint;
	    });

	    // Now time to set up our x axis scale
	    var x = d3.scale.linear()
	    	.range([0, width])
	    	.domain([0, xMax]);

		var xAxis = d3.svg.axis()
			.scale(x)
			.orient("bottom");

		var yAxis = d3.svg.axis()
			.scale(y)
			.orient("left")
			.ticks(10, "%");

	// Find the html element we want to render the
	// chart in, select it, and apply our properties
	var svg = d3.select(element).append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// Add our x and y axes to the chart
	svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
      	.append("text")
		.attr("y", 30)
		.attr('x', 450)
		.attr("dy", "1em")
		.style("text-anchor", "end")
		.text("days");;

  	svg.append("g")
		.attr("class", "y axis")
		.call(yAxis)
		.append("text")
		.attr("transform", "rotate(-90)")
		.attr("y", -60)
		.attr('x', -250)
		.attr("dy", "1em")
		.style("text-anchor", "end")
		.text("Percent Survival");

	//Set up a crossfilter so we can easily calculate percentages later
	var patients = crossfilter(data);
	var totalPatients = data.length;

	var patientsByTimeToEndpoint = patients.dimension(function(d) { 
		return d.timeToEndpoint; 
	});

	//Time to plot the points
	svg.selectAll(".circle")
		.data(data)
		.enter()
		.append('circle')
		.attr('class', 'circle')
		.attr('r', 5)
		.attr('cx', function(d) {
			return x(d.timeToEndpoint);
		})
		.attr('cy', function(d) {
			patientsByTimeToEndpoint.filterRange([0, d.timeToEndpoint]);
			var patientsAlive = patients.groupAll().reduceCount().value();
			var percent = invertY(patientsAlive/totalPatients);
			patientsByTimeToEndpoint.filterAll();
			return percent;
		})
		.style('fill', function(d) {
			if(d.censored) {
				return '#f93';
			}
			return '#4183c4';
		});

		$('svg circle').tipsy({ 
        gravity: 'w', 
        html: true, 
        title: function() {
          var d = this.__data__;
          var string = '<div>';
          string +=  '<h4>' + d.name + ' (' + d.age + d.sex + ') </h4>';
          string += '<h6> Dx date: ' + d.startDate.format('MM/DD/YYYY') + '</h6>';
          if (d.censored) {
          	string += '<h6> Censor date:' + d.endDate.format('MM/DD/YYYY') + '</h6>';
          } else {
          	string += '<h6> Death date:' + d.endDate.format('MM/DD/YYYY') + '</h6>';
          }
          string += '<h6> Time to event: ' + d.timeToEndpoint + ' days </h6>';
          string += '</div>';
          return string; 
        }
      });


	//Add tooltips to our circles

	// Draw a path through the points
		// 1. Define the line
		var valueline = d3.svg.line()
		    .x(function(d) { 
		    	return x(d.timeToEndpoint); 
		    })
		    .y(function(d) { 
		    	patientsByTimeToEndpoint.filterRange([0, d.timeToEndpoint]);
				var patientsAlive = patients.groupAll().reduceCount().value();
				var percent = invertY(patientsAlive/totalPatients);
				patientsByTimeToEndpoint.filterAll();
				return percent; 
			})
			.interpolate('step-after');

		// 2. Add the line to graph
	    svg.append("path")
	        .attr("class", "line")
	        .attr("d", valueline(data));


	newData = data.filter(function(d) {
		return d.censored;
	}); 

	totalCensored = newData.length;

	if(totalCensored/totalPatients * 100 < 50) {

		var floor = Math.floor(totalPatients/2);
		console.log(floor);

		newPatients = data.filter(function(d) {
			return d.timeToEndpoint > floor;
		});

		median = 'estimated median = ' + data[floor].timeToEndpoint + ' days';

	} else {
		median = 'median survival is not calculable'
	}


	count = 'n = ' + totalPatients;

	$('#n').text(count);
	$('#survival').text(median);
}

// Call the function
createSurvivalChart('.chart', patients);

// Update function
var updateChart = function(data) {

	var svg = d3.select('svg g');

		// Set up our chart properties
	var margin = {top: 20, right: 20, bottom: 60, left: 60},
    width = 960 - margin.left - margin.right,
    height = 600 - margin.top - margin.bottom;

		//Set up a crossfilter so we can easily calculate percentages later
	var patients = crossfilter(data);
	var totalPatients = data.length;

	var patientsByTimeToEndpoint = patients.dimension(function(d) { 
		return d.timeToEndpoint; 
	});

    var xMax = d3.max(data, function(d) {
    	return d.timeToEndpoint;
    });

    var y = d3.scale.linear()
	.range([height, 0])
	.domain([0, 1]);

    // Now time to set up our x axis scale
    var x = d3.scale.linear()
    	.range([0, width])
    	.domain([0, xMax]);

    var xAxis = d3.svg.axis()
	.scale(x)
	.orient("bottom");


    d3.select('.x.axis').call(xAxis);

	var circles = d3.selectAll(".circle")
		.data(data, function(d) {
			return d;
		});

		    //SVGs consider Y = 0 to be the top. Need to invert
	    var invertY = d3.scale.linear()
	    	.range([height, 0])
	    	.domain([1, 0]);

    //Remove old elements
    circles.exit()
	    .attr("class", "exit")
	    .transition()
		.duration(750)
		.style("fill-opacity", 1e-6)
		.remove();

	d3.select('.line').remove();

	//Add new elements
		//Time to plot the points
	svg.selectAll(".circle")
		.data(data)
		.enter()
		.append('circle')
		.style("fill-opacity", 1e-6)
		.attr('class', 'circle')
		.attr('r', 5)
		.attr('cx', function(d) {
			return x(d.timeToEndpoint);
		})
		.attr('cy', function(d) {
			patientsByTimeToEndpoint.filterRange([0, d.timeToEndpoint]);
			var patientsAlive = patients.groupAll().reduceCount().value();
			var percent = invertY(patientsAlive/totalPatients);
			patientsByTimeToEndpoint.filterAll();
			return percent;
		})
		.style('fill', function(d) {
			if(d.censored) {
				return '#f93';
			}
			return '#4183c4';
		})
		.transition()
		.duration(750)
		.style("fill-opacity", 1);

		$('svg circle').tipsy({ 
        gravity: 'w', 
        html: true, 
        title: function() {
          var d = this.__data__;
          var string = '<div>';
          string +=  '<h4>' + d.name + ' (' + d.age + d.sex + ') </h4>';
          string += '<h6> Dx date: ' + d.startDate.format('MM/DD/YYYY') + '</h6>';
          if (d.censored) {
          	string += '<h6> Censor date:' + d.endDate.format('MM/DD/YYYY') + '</h6>';
          } else {
          	string += '<h6> Death date:' + d.endDate.format('MM/DD/YYYY') + '</h6>';
          }
          string += '<h6> Time to event: ' + d.timeToEndpoint + ' days </h6>';
          string += '</div>';
          return string; 
        }
      });

		var valueline = d3.svg.line()
		    .x(function(d) { 
		    	return x(d.timeToEndpoint); 
		    })
		    .y(function(d) { 
		    	patientsByTimeToEndpoint.filterRange([0, d.timeToEndpoint]);
				var patientsAlive = patients.groupAll().reduceCount().value();
				var percent = invertY(patientsAlive/totalPatients);
				patientsByTimeToEndpoint.filterAll();
				return percent; 
			})
			.interpolate('step-after');

		// 2. Add the line to graph
	    svg.append("path")
	    	.style("fill-opacity", 1e-6)
	        .attr("class", "line")
	        .attr("d", valueline(data))
	        .transition()
			.duration(750)
			.style("fill-opacity", 1);



	newData = data.filter(function(d) {
		return d.censored;
	}); 

	totalCensored = newData.length;

	if(totalCensored/totalPatients * 100 < 50) {

		var floor = Math.floor(totalPatients/2);
		console.log(floor);

		newPatients = data.filter(function(d) {
			return d.timeToEndpoint > floor;
		});

		median = 'estimated median = ' + data[floor].timeToEndpoint + ' days';

	} else {
		median = 'median survival is not calculable'
	}


	count = 'n = ' + totalPatients;

	$('#n').text(count);
	$('#survival').text(median);

}

var applyUpdate = function() {

	var date = null;
	var age = null;
	var include = false;
	var newData = patients;
	var string = 'Currently showing patients: ';

	//Get the value of the filter fields 
	if($('#date').val()) {
		date = moment($('#date').val(), 'MM/DD/YYYY'); 
		newData = newData.filter(function(d) {
			return d.startDate, date, moment(d.startDate, 'MM/DD/YYY').isAfter(date);
		});

		string += ' diagnosed after<span class="em"> ' + date.format('MM/DD/YYYY') + '</span>';;
	} 

	if($('#age').val()) {
		age = $('#age').val();
		newData = newData.filter(function(d) {
			 return d.age >= age;
		});

		string += ' <span class="em"> ' + age +  '</span> or older at diagnosis';
	}

	console.log($('#include').is(':checked'));
	
	
	if($('#include').is(':checked')) {
		include = true;
		newData = newData.filter(function(d) {
			console.log(d.include);
			return d.include == 'Y';
		}); 

		string += ' <span class="em"> first treated here </span> ';
	}


	if($('#transplant').is(':checked')) {
		transplant = true;
		newData = newData.filter(function(d) {
			console.log(d.transplant);
			return d.transplant == 'y';
		}); 

		string += ' who have a had a <span class="em">bone marrow transplant</span>';
	}


	$('#filters').html(string);


	updateChart(newData);
}


// Click listener
$( "#apply" ).click(function() {
	applyUpdate();
});

$( "#reset" ).click(function() {
	updateChart(patients);
	$('#filters').html('Currently showing all patients');
});