var generate_input_group = function(input_type, context) {
	input_type = 'input-'+input_type;
	if(context.type === '' || context.type === undefined) context.type = 'text';
	if(context.id === '' || context.id === undefined) context.id = context.label.toLowerCase().replace(/ /g,'_').replace(/[^\w-]+/g,'');
	if(context.label_class) context.label_class = ' '+context.label_class;
	if(context.options) {
		try {
			var arr = context.options.split(',');
			context.options = arr;
		} catch(err) {
			context.options = null;
		}
	}
	if(templates[input_type]) {
		return templates[input_type](context);
	}
}

Handlebars.registerHelper('sub_template', function(name, context) {
	var context = $.extend({},this,context.hash);
	if(name === 'input_text') {
		return generate_input_group('text', context);
	} else if(name === 'input_toggle') {
		return generate_input_group('toggle', context);
	} else if(name === 'input_select') {
		return generate_input_group('select', context);
	} else {
		if(templates[name]) {
			var template = templates[name];
			return template(context);
		}
	}
	//return new Handlebars.SafeString(template(context));
});

Handlebars.registerHelper('render_template', function(name, context) {
	var template =  templates[name];
	var new_context = $.extend({},this,context.hash);
	return new Handlebars.SafeString(template(new_context));
});

/*
	Handlebars helper: toLowerCase
	self-explanatory
*/
Handlebars.registerHelper('toLowerCase', function(str) {
	return str.toLowerCase();
});

var set_current_user = function(user)
{
	sessionStorage.current_user = JSON.stringify(user);
	current_user = user;
	$('header .navbar-nav').fadeIn('fast', function() {
		$(this).find('span.username').text(current_user.username);
	});
};

var get_current_user = function()
{
	current_user = JSON.parse(sessionStorage.current_user);
	return current_user;
};

var set_route = function(route)
{
	if(route.charAt(0) === '#') route = route.substr(1);
	if(route.charAt(0) === '/') route = route.substr(1);
	App.navigate(route, true);
};

var index_of_with_attr = function(array, attr, value) {
	for(var i = 0; i < array.length; i += 1) {
		if(array[i][attr] === value) {
			return i;
		}
	}
	return false;
};

var convert_mb_to_b = function(mb) {
	return Number((mb * 1024 * 1024).toFixed(2));
};

var convert_b_to_mb = function(b) {
	return Number((b / 1024 / 1024).toFixed(2));
};

function allowDrop(ev) {
	ev.preventDefault();
}

function drag(ev) {
	var id = $(ev.target).find('h5').text(),
		user_li = $(ev.target).parents('li[user-index]');
	$(ev.target).attr({
		"id": id,
		"user-index": user_li.attr('user-index')
	});
	ev.dataTransfer.setData("text", id);
	$('body').addClass('drag-active');
}

function drop(ev) {
	//console.log(ev);
	ev.preventDefault();
	var device_mac = ev.dataTransfer.getData("text"),
		device_li = $('li[mac="'+device_mac+'"]'),
		original_user_index = device_li.attr('user-index');

	if($(ev.target).hasClass('user-devices-list')) {//prevents user from dragging into into other devices
		ev.target.appendChild(document.getElementById(device_mac));
		var user_li = device_li.parents('li[user-index]'),
			user_index = user_li.attr('user-index'),
			device_index = index_of_with_attr(users_json.users[original_user_index].devices, 'mac', device_mac);

		//console.log(original_user_index+' === '+user_index);

		if(original_user_index !== user_index) {

			//prepare JSON for orc
			var device_obj = {
				"mac": device_mac,
				"dsoctets": users_json.users[original_user_index].devices[device_index].dsoctets,
				"usoctets": users_json.users[original_user_index].devices[device_index].usoctets,
				"profile": users_json.users[user_index].name
			};

			if(device_obj.profile.toLowerCase() === 'guest') device_obj.profile = null;

			//maintain the users_json global
			var device_string = JSON.stringify(users_json.users[original_user_index].devices[device_index]);
			//remove device
			users_json.users[original_user_index].devices.splice(device_index, 1);
			//add device to new user
			users_json.users[user_index].devices.push(JSON.parse(device_string));

			//tell orc
			orc_put_device(device_obj, '', function(response) {
				//
			}, function(response) {
				flash_message('Error updating (ORC)');
			});

		}
		
	}
	$(document.getElementById(device_mac)).removeAttr('id');
	$('body').removeClass('drag-active');
	//update the JSON
	//update_users_json_network_map();
}

var flash_message = function(message, severity)
{
	if(message === undefined) return false;
	if(severity === undefined) severity = 'danger';
	severity = 'alert-'+severity;
	var bar = $('#flash-message');
	bar.attr('class', severity).find('p').text(message);
	clearTimeout(flash_timeout);
	bar.slideDown('fast', function() {
		/*
		flash_timeout = setTimeout(function() {
			bar.fadeOut('slow', function() {
				bar.find('p').text('');
			});
		}, 5000);
		*/
	});
};

var flash_message_close = function(instant)
{
	var bar = $('#flash-message');
	if(instant) bar.hide();
	else bar.fadeOut('slow');
};

var dropdown = {

	load: function(id, data, value)
	{
		var dataset = JSON.parse(JSON.stringify(data));

		if(value !== undefined) {

		} else {
			dataset.class = dataset.choices[0].class;
			dataset.value = dataset.choices[0].value;
			dataset.label = dataset.choices[0].label;
		}

		$(id).html(templates['editor-dropdown'](dataset));
	},

	validate: function(id) 
	{
		var wrapper = $(id),
			container = wrapper.find('.editor-dropdown'),
			input = container.find('a.toggle').first(),
			value = input.attr('value');

		if(input.length > 0) {
			container.removeClass('has-error');
			if(value !== '' && value !== undefined) {
				return value;
			} else {
				container.addClass('has-error');
			}
		}
	}

};

var typeahead_input = {

	load: function(id, data, attrs)
	{
		$(id).html(templates['editor-typeahead'](attrs));
		$(id).find('input').typeahead({
			hint: true,
			highlight: true,
			minLength: 1
		}, {
			source: substringMatcher(data)
		});
	},

	get: function(id) {

	},

	validate: function(id) {
		var wrapper = $(id),
			container = wrapper.find('.editor-typeahead'),
			input = container.find('.tt-input').first(),
			value = input.val();

		if(input.length > 0) {
			container.removeClass('has-error');
			if(value !== '' && value !== undefined) {
				return value;
			} else {
				container.addClass('has-error');
			}
		}
	}

};

var orc_put_profile = function(profile, profile_name, callback, error_callback) {

	//you can specify a profile name (needed if you have to update the "name")
	if(profile_name === '' || profile_name === undefined) {
		profile_name = profile.name;
	}
	
	$.ajax({
		type: "PUT",
		url: orchestrator_sub+'/'+current_user.uuid+'/profile/'+profile_name,
		contentType: "application/json",
		dataType: "json",
		data: JSON.stringify(profile),
		success: function(response) {
			if (typeof(callback) == typeof(Function))
				callback(response);
		},
		error: function(response) {
			if (typeof(error_callback) == typeof(Function))
				error_callback(response);
		}
	});
};

var orc_put_device = function(device, device_mac, callback, error_callback) {
	if(device_mac === '' || device_mac === undefined) {
		device_mac = device.mac;
	}
	
	//http://hostname:port/subscriber/eb8339cd-1c96-487b-b98e-d579d1967e6b/network/device/00:00:00:00

	$.ajax({
		type: "PUT",
		url: orchestrator_sub+'/'+current_user.uuid+'/network/device/'+device_mac,
		contentType: "application/json",
		dataType: "json",
		data: JSON.stringify(device),
		success: function(response) {
			if (typeof(callback) == typeof(Function))
				callback(response);
		},
		error: function(response) {
			if (typeof(error_callback) == typeof(Function))
				error_callback(response);
		}
	});
};

var substringMatcher = function(strs) {
	return function findMatches(q, cb) {
		var matches, substringRegex;

		// an array that will be populated with substring matches
		matches = [];

		// regex used to determine if a string contains the substring `q`
		substrRegex = new RegExp(q, 'i');

		// iterate through the pool of strings and for any string that
		// contains the substring `q`, add it to the `matches` array
		$.each(strs, function(i, str) {
			if (substrRegex.test(str)) {
				matches.push(str);
			}
		});

		cb(matches);
	};
};

