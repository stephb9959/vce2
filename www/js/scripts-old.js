//
var templates = {},
	users_json,
	users_quota,
	users_usage,
	refresh_clock;

/*
	Handlebars helper: toLowerCase
	self-explanatory
*/
Handlebars.registerHelper('toLowerCase', function(str) {
	return str.toLowerCase();
});

/*
	Document ready
	Runs once everything is loaded in the DOM
*/
$(document).ready(function() {

	//load templates
	//templates['tile-menu'] = Handlebars.compile($("#tpl-tile-menu").html());
	$('script[id^="tpl-"]').each(function(item) {
		var template_id = $(this).attr('id').substr(4);
		templates[template_id] = Handlebars.compile($(this).html());
	});

	//determine which page to load
	if($('section#page-dashboard').length > 0) dashboard_page_load();
	if($('section#page-parental').length > 0) parental_page_load();
	if($('section#page-firewall').length > 0) firewall_page_load();
	if($('section#page-network-map').length > 0) network_map_page_load();
	if($('section#page-usage').length > 0) usage_page_load();

});

var refresh_dhcp_leases = function()
{
	$.get('lib/dhcp-leases.php', function(data) {

		var guest_li = $('ul.network-users-list li.type-guest');
				
		var data_lines = data.split(/\r\n|\n/);
		var guest_devices = [];
		for (var i = 0; i < data_lines.length - 1; i++) {
			var device_data = data_lines[i].split(' ');

			//device only gets added if it doesn't exist
			if($('ul.user-devices-list li[mac="'+device_data[1]+'"]').length === 0)
			{
				var tdevice = {
					description: device_data[3],
					index: i,
					mac: device_data[1],
					type: ''
				};
				guest_devices.push(tdevice);
			}
			
		}

		$.each(guest_devices, function(j, device) {
			guest_devices.index = j;
			guest_li.find('ul.user-devices-list').append(templates['network-users-devices-list-item'](device));
		});

		save_users_json();
			
	});
};

var start_refresh_clock = function()
{
	window.refresh_clock = window.setInterval(refresh_dhcp_leases, 5000);
};

var network_map_page_load = function()
{
	var page = $('section#page-network-map');
	var users_list = page.find('ul.network-users-list');
	var unknown = 0;

	$({}).queue(function(next) {
	}).queue(function(next) {
	});

	get_users_json(function(data) {
	//api_call('devices', '', '', function(data) {

		var unknown_vendors = [];

		//store it as global variable
		//users_json = data;
		var guest_index;

		$.each(data.users, function(i, user) {
			//console.log(user);
			user.index = i;

			if(user.name === 'Guest') user.type = 'guest';

			var user_li = $(templates['network-users-list-item'](user));
			//loop through their devices
			$.each(user.devices, function(j, device) {
				device.index = j;
				if(device.vendor === undefined) {
					unknown_vendors.push(device);
				}
				user_li.find('ul.user-devices-list').append(templates['network-users-devices-list-item'](device));
			});
			users_list.append(user_li);
		});

	});
	
	$(document).on('click', '#btn-add-network-users', function(event) {
		event.preventDefault();
		if(users_list.find('.add-row').length === 0)
		{
			users_list.append(templates['network-users-list-add-row']());
			users_list.find('.add-row').slideDown();
		}
	});

	$(document).on('click', '#btn-submit-users-list', function(event) {
		event.preventDefault();
		var toggle = $(this);

		var target_table = toggle.parents('.users-list');
		var form = target_table.find('.add-row');
		var rule = {
			name: form.find('input[name="name"]').val(),
		};
		form.remove();
		rule.index = target_table.children().length;//this is a big assumption;
		target_table.append(templates['network-users-list-item'](rule));
	});
};

var update_users_json_network_map = function()
{
	//a ghetto check to avoid trying to save mid drag...
	if($('body').hasClass('drag-active')) return false;

	$('.network-users-list > li').each(function() {
		var user_li = $(this);
		var name = user_li.find('.user-name').text();
		if(name === '' || name === undefined) return;

		//look for our user
		user_index = index_of_with_attr(users_json.users, 'name', name);
		if(user_index === false)//crud, we have to add this new person
		{
			users_json.users.push({
				name: name,
				devices: [],
				parental: {
					disabled: false,
					tracked: false,
					pagerating: 7,
					enabled: {
						whitelist: false,
						blacklist: false,
						timeblock: false,
						quotaMB: false,
					},
					whitelist: [],
					blacklist: [],
					timeblock: {},
					quotaMB: 0
				}
			});
			user_index = users_json.users.length - 1;
		}

		//don't need to save devices under guest
		//if(name === 'Guest') return;

		//clear out existing devices
		users_json.users[user_index].devices = [];
		//now store their devices
		user_li.find('ul.user-devices-list li').each(function() {
			device_li = $(this);
			var device = {
				mac: device_li.find('.mac').text(),
				type: device_li.attr('class').substr(5),
				description: device_li.find('h5').text()
			};
			users_json.users[user_index].devices.push(device);
		});

	});

	//now save
	save_users_json();

};

var get_users_json = function(callback)
{
	api_call('config', '', '', function(data) {
		users_json = data;
		if(typeof(callback) === typeof(Function)) {
			callback(users_json);
		}
	});
};

var get_users_json_device = function(mac_address)
{
	var result;
	$.each(users_json.users, function(i, user) {
		$.each(user.devices, function(j, device) {
			if(device.mac === mac_address) {
				result = device;
				return false;
			}
		});
		if(result) return result;
	});

	return result;
};

var save_users_json = function()
{
	//where the guest account resides in that array
	var guest_index = index_of_with_attr(users_json.users, 'name', 'Guest');

	//retrieve and compare guest devices
	api_call('devices', '', '', function(data) {
		var current_json = data;
		console.log(data);
		var current_guest_index = index_of_with_attr(current_json.users, 'name', 'Guest');
		if(current_json.users[current_guest_index].devices.length > 0)
		{
			$.each(current_json.users[current_guest_index].devices, function(i, device) {
				check = get_users_json_device(device.mac);
				if(check === undefined || check === '') {//device not found, so we can add to guest
					users_json.users[guest_index].devices.push(device);
					if($('section#page-network-map').length > 0) {
						$('ul.network-users-list li[user-index="'+guest_index+'"] ul.user-devices-list').append(templates['network-users-devices-list-item'](device));
					}
				}
			});
		}
		
		//now run call to save file
		$.ajax({
			type: 'PUT',
			url: 'api/config',
			//dataType: "text",
			data: JSON.stringify(users_json),
			success: function(response) {
				console.log('Record updated');
			},
			error: function() {
				console.log('Record update error');
			}
		});

	});
};

var get_usage = function(callback)
{
	api_call('usage', '', '', function(data) {
		
		var users = [];
		//scrub data; re-assemble to users
		$.each(data.users, function(i, device) {
			console.log(device);
			var user_index = index_of_with_attr(users, 'name', device.name);
			var sent = parseInt(device.usage.sent, 10);
			var received = parseInt(device.usage.received, 10);
			if(isNaN(sent)) sent = 0;
			if(isNaN(received)) received = 0;
			if(user_index !== false)
			{
				users[user_index].sent += sent;
				users[user_index].received += received;
			} else {
				var user = {
					name: device.name,
					sent: sent,
					received: received
				};
				users.push(user);
			}
		});

		users_usage = users;
		if(typeof(callback) === typeof(Function)) {
			callback(users_quota);
		}
	});
};

var get_timeblock_day_code = function()
{
	return [
		{code: 's', day: 'Sun'},
		{code: 'm', day: 'Mon'},
		{code: 't', day: 'Tue'},
		{code: 'w', day: 'Wed'},
		{code: 'r', day: 'Thu'},
		{code: 'f', day: 'Fri'},
		{code: 'y', day: 'Sat'}
	];
};

var firewall_page_load = function()
{
	var page = $('section#page-firewall');
	var rules_table = page.find('table.firewall-rules');
	var port_table = page.find('table.firewall-redirects');
	var raw_rules = '';

	//tip_ajax(firewall_page_process,$('#firewall-default').attr('name'),'firewall-default');
	tip_ajax('uci show firewall', null, function(response) {
		raw_rules = response;
		//if(raw_rules === '') raw_rules = $('#firewall-default').text();

		//parse it!
		var firewall = parse_firewall_rules(raw_rules);

		if(firewall.redirect) {
			$.each(firewall.redirect, function(i, rule) {
				var obj = rule;
				obj.index = i;
				obj.class = rule.enabled === undefined || rule.enabled === '1' ? 'enabled' : 'disabled';
				port_table.find('tbody').append(templates['firewall-redirect-row'](obj));
			});
		}

		if(firewall.rule) {
			$.each(firewall.rule, function(i, rule) {
				var obj = rule;
				obj.index = i;
				obj.class = rule.enabled === undefined || rule.enabled === '1' ? 'enabled' : 'disabled';
				rules_table.find('tbody').append(templates['firewall-rule-row'](obj));
			});
		}

	});

	$(document).on('click', '.toggle-rule-btn', function(event) {

		event.preventDefault();

		var toggle = $(this),
			index = toggle.parents('tr').attr('rule-index'),
			value = 1,
			firewall_type = toggle.attr('firewall-type'),
			new_class = 'enabled';

		//status is based on the class
		if(toggle.find('span').hasClass('enabled')) //enable; so we disable it
		{
			value = 0;
			new_class = 'disabled';
		}
		var uci_attr = 'firewall.@'+firewall_type+'['+index+'].enabled';
		var command = 'uci set '+uci_attr+'='+value;

		tip_ajax(command, null, function(response) {
			tip_ajax('uci commit firewall;/etc/init.d/network restart');
			toggle.find('span').attr('class', 'fa '+new_class);
		});

	});

	$(document).on('click', '.delete-rule-btn', function(event) {
		event.preventDefault();
		var toggle = $(this),
			parent_row = toggle.parents('tr'),
			parent_tbody = parent_row.parent(),
			index = parent_row.attr('rule-index'),
			firewall_type = toggle.attr('firewall-type');

		var uci_attr = 'firewall.@'+firewall_type+'['+index+']';
		var command = 'uci delete '+uci_attr;

		tip_ajax(command, null, function(response) {
			tip_ajax('uci commit firewall;/etc/init.d/network restart');
			parent_row.fadeOut(function() {
				$(this).remove();
				reindex_table_rows(parent_tbody, 'rule-index');
			});
		});
	});

	$(document).on('click', '#btn-add-firewall-redirect', function(event) {
		event.preventDefault();
		if(port_table.find('tbody tr.add-row').length === 0)
		{
			port_table.find('tbody').append(templates['firewall-redirect-add-row']());
			port_table.find('tr.add-row').slideDown();
		}
	});

	$(document).on('click', '#btn-add-firewall-rule', function(event) {
		event.preventDefault();
		if(rules_table.find('tbody tr.add-row').length === 0)
		{
			rules_table.find('tbody').append(templates['firewall-rule-add-row']());
			rules_table.find('tr.add-row').slideDown();
		}
	});

	$(document).on('click', '#btn-submit-firewall-rule', function(event) {
		event.preventDefault();
		var toggle = $(this);
				var firewall_type = toggle.attr('firewall-type');
		var target_table = toggle.parents('table');
		var form = target_table.find('tr.add-row');
		var rule;
		if(firewall_type=='rule') {
		rule = {
			name: form.find('input[name="name"]').val(),
			target: form.find('select[name="target"]').val(),
			proto: form.find('select[name="proto"]').val(),
			dest_port: form.find('input[name="dest_port"]').val(),
			src: form.find('select[name="src"]').val(),
			family: form.find('select[name="family"]').val(),
		};
		} else {
			rule = {
				name: form.find('input[name="name"]').val(),
				target: 'DNAT',
				src: 'wan',
				dest: 'lan',
				proto: form.find('select[name="proto"]').val(),
				src_dport: form.find('input[name="src_dport"]').val(),
				dest_ip: form.find('input[name="dest_ip"]').val(),
				dest_port: form.find('input[name="dest_port"]').val(),
			};
		}
		var command = 'uci add firewall '+firewall_type+';';
		$.each(rule, function(k, v) {
			if(v.indexOf(' ') >= 0) v = "'"+v+"'";
			command += "uci set firewall.@"+firewall_type+"[-1]."+k+"="+v+";";
		});
		tip_ajax(command, null, function(response) {
		tip_ajax('uci commit firewall;/etc/init.d/network restart');
		form.remove();
		rule.index = target_table.find('tbody > tr').length;
		rule.class = 'enabled';
		target_table.find('tbody').append(templates['firewall-'+firewall_type+'-row'](rule));
		});
	});

	$(function () {
		materialRipple();
	});
	
	function materialRipple() {
		$(".fab:not(.disabled)").on("mousedown", function (e) {
			recycler();
			var offset = $(this).offset();
			var XCoord = (e.pageX - offset.left);
			var YCoord = (e.pageY - offset.top);
			
			if ($(this).outerWidth() < 199) {
			$(this).children().append($("<div class='ripple ripple-active'></div>").css({
				left: XCoord - 4.5,
				top: YCoord - 2,
				height: $(this).width() * 0.2,
				width: $(this).width() * 0.2
				})).on("mouseup", function () {
					$(this).children('div').removeClass('ripple-active');
				});
			} else {
			$(this).children().append($("<div class='ripple ripple-active'></div>").css({
				left: XCoord - 4.5,
				top: YCoord - 2,
				height: $(this).width() * 0.05,
				width: $(this).width() * 0.05
				})).on("mouseup", function () {
					$(this).children('div').removeClass('ripple-active');
				});
			}
		});
	}
	
	function recycler() {
		$('html').find('.ripple:not(.active)').remove();
	}
};

var reindex_table_rows = function(selector, attr)
{
	if(attr === undefined) attr = 'item-index';//let's use this from now on
	$(selector).find('tr').each(function(i, row) {
		$(row).attr(attr, i);
	});
};

var tip_update = function(node) {
	if(node.type!="checkbox")
		return;
	var key	= node.name;
	var value = node.checked?1:0;
	var command = 'uci set '+key+'='+value;
	alert(command);
	tip_ajax(command,null,function(response) {
		alert(response);
	});
};

/*
	the call to our uci.php file which does some fetching

	command (str): our required str command
	params (object): additional parameters in JS object {}
	callback (function): what to do with the response
*/
var tip_ajax = function(command, params, callback) {

	if(command === undefined || command === '') return false;
	
	if(typeof params === 'object') {
		params = {str: command};
	} else {
		params = {};
		params.str = command;
	}

};

var api_call = function(command, method, params, callback)
{
	if(command === undefined || command === '') return false;

	if(method === undefined || method === '')
		method = 'GET';
	
	if(typeof params !== 'object') {
		params = {};
	}

	$.ajax({
		type: method,
		dataType: 'JSON',
		url: 'api/'+command,
		data: params,
		success: function(response) {
			if(typeof(callback) === typeof(Function)) {
				callback(response);
			}
		},
		error: function(error) {
			//this shouldn't happen... I hope ~_~
			//salvage
			if(error.status === 200) {
				try {
					var text = error.responseText.replace(/(\r\n|\n|\r)/gm,"");
					text = text.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,[,\s]*,/g, ',');
					//console.log(text);
					var data = JSON.parse(text);
					if(typeof(callback) === typeof(Function)) {
						callback(data);
					}
				} catch(err) {}
			} else {
				alert(error.status+': '+error.statusText);
			}
		}
	});
};

var parse_firewall_rules = function(raw_rules)
{
	//we're going to re-assemble this into a workable object
	var firewall = {
		defaults: [],
		zone: [],
		forwarding: [],
		rule: [],
		include: [],
		redirect: []
	};

	//now we parse this sucka
	var all_rules = raw_rules.split(',');
	$.each(all_rules, function(i, rule) {
		//split further into a key value pair
		if(rule !== '') {
			var kv = rule.split('=');
			var key_parts = kv[0].split('.');
			var key_cat = key_parts[1].replace(/[^a-z]/gi, '');
			var key_index = key_parts[1].replace(/[^0-9]/gi, '');
			var key_attribute = key_parts[2];

			//re-assemble our object
			if(key_attribute !== undefined) {
				if(firewall[key_cat][key_index] === undefined)
					firewall[key_cat][key_index] = {};
				firewall[key_cat][key_index][key_attribute] = kv[1];
			}
		}
	});

	return firewall;
};

var usage_page_load = function()
{
	var page = $('section#page-usage');

	$({})
		.queue(function(next) {
			get_users_json(function() {
				next();
			});
		}).queue(function(next) {
			get_usage(function() {
					
				//charting time
				var chart_data = [];

				$.each(users_usage, function(i, user) {
					user_index = index_of_with_attr(users_json.users, 'name', user.name);
					//scrubber
					var item = {
						name: user.name,
						//totalSent: (parseInt(user.totalSent, 10) / 1024 / 1024).toFixed(2),
						totalReceived: convert_b_to_mb(user.received),
						totalSent: convert_b_to_mb(user.sent)
					};

					var quota = 0;
					if(user_index !== false) quota = Math.round(convert_b_to_mb(parseInt(users_json.users[user_index].parental.quotaMB, 10)));

					item.underReceived = item.totalReceived;

					if(quota > 0) {
						item.full = quota - item.totalReceived;
						item.quota = quota;
						if(item.totalReceived > quota) {
							item.color = '#c64746';
							item.extraReceived = item.totalReceived - quota;
							item.underReceived = quota;
						}
					} else {
						item.full = 0;//item.totalReceived;
						//item.color = '#c9c9c9';
					}

					chart_data.push(item);
				});

				var chart = AmCharts.makeChart("quota-chart", {
					"type": "serial",
					"theme": "none",
					"percentPrecision": 1,
					"precision": 1,
					"dataProvider": chart_data,
					"startDuration": 1,
					"graphs": [{
						"valueField": "quota",
						"lineColor": "#7a201f",
						"columnWidth": 0.3,
						"lineThickness": 2,
						"noStepRisers": true,
						//"stackable": false,
						"type": "step",
						"alphaField": "alpha"
					}, {
						"valueField": "underReceived",
						"lineColor": "#c9c9c9",
						//"clustered": false,
						"columnWidth": 0.3,
						"showBalloon": true,
						"balloonText": "Received: [[totalReceived]]MB",
						"fillAlphas": 1,
						//"stackable": false,
						"type": "column",
						//"colorField": "color",
						//"lineColorField": "color",
						"alphaField": "alpha"
					}, {
						"valueField": "full",
						"fillColors": "#e9e9e9",
						"columnWidth": 0.3,
						"showBalloon": true,
						"balloonText": "Received: [[totalReceived]]MB",
						"type": "column",
						"lineAlpha": 0,
						"fillAlphas": 0.8,
						"alphaField": "alpha"
					}, {
						"valueField": "extraReceived",
						"fillColors": "#c64746",
						"lineColor": "#c64746",
						"columnWidth": 0.3,
						"showBalloon": true,
						"balloonText": "[[totalReceived]]MB",
						"type": "column",
						//"lineAlpha": 0,
						"fillAlphas": 1,
						"alphaField": "alpha"
					}, {
						"newStack": true,
						"valueField": "totalSent",
						"lineColor": "#559",
						//"clustered": false,
						"columnWidth": 0.3,
						"showBalloon": true,
						"balloonText": "Sent: [[totalSent]]MB",
						"fillAlphas": 1,
						"stackable": true,
						"type": "column",
						"alphaField": "alpha"
					}
					],
					"columnWidth": 0.98,
					"categoryField": "name",
					"categoryAxis": {
						"gridAlpha": 0,
						"position": "left",
						"labelColorField": "color"
					},
					"valueAxes": [{
						"stackType": "regular",
						"gridAlpha": 0
					}]
				});

			});
		});
};

var parental_page_load = function()
{
	var page = $('section#page-parental');
	var user_list = page.find('.users-list');

	get_users_json(function() {
		$.each(users_json.users, function(k, item) {
			item.index = k;
			user_list.append(templates['parental-users-list-item'](item));
		});
	});
	
	$(document).on('click', 'ul.user-toggles-list li span', function(event) {
		event.preventDefault();

		var toggle = $(this);
		var li = toggle.parents('li');
		var parental_setting = toggle.attr('parental-setting');
		var parental_setting_type = toggle.attr('setting-type');
		var set_to = toggle.hasClass('enabled-true') ? false : true;
		var name = li.find('h3').text();

		var user_index = index_of_with_attr(users_json.users, 'name', name);
		if(user_index !== undefined) {
			if(parental_setting_type !== '' && parental_setting_type !== undefined)
				users_json.users[user_index].parental[parental_setting_type][parental_setting] = set_to;
			else
				users_json.users[user_index][parental_setting] = set_to;
			toggle.toggleClass('enabled-true');
			save_users_json();
		}

	});

	$(document).on('click', 'ul.users-list a.btn-expand-editor', function(event) {
		var btn = $(this);
		var li = btn.parents('li');
		if(btn.hasClass('expanded')) {
			btn.removeClass('expanded');
			li.find('.parental-editor').slideUp();
		} else {
			var user = users_json.users[li.attr('item-index')];
			var parental_editor = li.find('.parental-editor');

			btn.addClass('expanded');

			if(parental_editor.length === 0) {
				li.append(templates['parental-users-editor']());
				parental_editor = li.find('.parental-editor');

				//rating!
				if(user.parental.pagerating !== undefined) parental_editor.find('select[name="pagerating"]').val(user.parental.pagerating);

				//blacklist!
				if(user.parental.blacklist.length > 0) {
					parental_editor.find('.blacklists').append(templates['parental-blacklist-input'](user.parental.blacklist));
				}

				//quota!
				parental_editor.find('.quota-controls input').val(convert_b_to_mb(user.parental.quotaMB));

				//timeblock!
				var days = get_timeblock_day_code();

				for(var y = 1; y <= 7; y++) {
					var row = $('<tr y="'+y+'" day="'+days[y-1].code+'"><th>'+days[y-1].day+'</th></tr>');
					for(var x = 1; x <= 48; x++) {
						row.append('<td x="'+x+'"></td>');
					}
					parental_editor.find('table.timeblock-table tbody').append(row);
				}

				//header times
				for(var h = 1; h <= 24; h++) {
					parental_editor.find('table.timeblock-table thead tr').first().append('<th colspan="2">'+h+'</th>');
				}

				//populate existing timeblock slots
				$.each(user.parental.timeblock, function(key, arr) {
					$.each(arr, function(i, num) {
						parental_editor.find('table.timeblock-table tbody tr[day="'+key+'"] td[x="'+num+'"]').addClass('selected');
					});
				});

			}
					
			li.find('.parental-editor').slideDown();
		}
	});

	$(document).on('click', '.blacklists .btn-remove-blacklist', function(event) {
		$(this).parent().slideUp(function() {
			$(this).remove();
		});
	});

	$(document).on('click', '.parental-editor .btn-add-blacklist', function(event) {
		$(this).parent().find('.blacklists').append(templates['parental-blacklist-input'](['']));
	});

	$(document).on('click', '.parental-editor table.timeblock-table tbody td', function(event) {

		var cell = $(this);
		var table = $(this).parents('table.timeblock-table');
		var last_cell = table.find('td.click');
		var new_x = cell.attr('x');
		var new_y = cell.parent().attr('y');
		
		if(event.shiftKey && last_cell) {
			var last_x = last_cell.attr('x');
			var last_y = last_cell.parent().attr('y');
			var last_state = last_cell.hasClass('selected');
			var low_x = last_x,
				low_y = last_y,
				hi_x = new_x,
				hi_y = new_y;
			
			if(last_x > new_x) {
				low_x = new_x;
				hi_x = last_x;
			}
			if(last_y > new_y) {
				low_y = new_y;
				hi_y = last_y;
			}
			
			for(var yi = low_y; yi <= hi_y; yi++) {
				for(var xi = low_x; xi <= hi_x; xi++) {
					var c = table.find('tr[y="'+yi+'"] td[x="'+xi+'"]');
					if(last_state) c.addClass('selected');
					else c.removeClass('selected');
				}
			}
			
			//break shift click
			table.find('td.click').removeClass('click');
			
			return true;
		}

		if(cell.hasClass('selected')) {
			cell.removeClass('selected');
		} else {
			cell.addClass('selected');
		}
		
		table.find('td.click').removeClass('click');
		cell.addClass('click');
	});

	$(document).on('click', '.parental-editor .btn-save-parental-options', function(event) {
		var li = $(this).parents('li');
		var editor = li.find('.parental-editor');
		var user_index = li.attr('item-index');
		var user = users_json.users[user_index];

		//rating
		var new_rating = editor.find('.rating-controls select').first().val();
		users_json.users[user_index].parental.pagerating = parseInt(new_rating, 10);

		//quota
		var new_quota = editor.find('.quota-controls input').first().val();
		if(isNaN(new_quota)) new_quota = '';
		users_json.users[user_index].parental.quotaMB = convert_mb_to_b(new_quota);

		//blacklists
		var blacklists = [];
		li.find('.blacklist-group > input').each(function(i, input) {
			url = $(input).val();
			if(url !== '' || url !== undefined) blacklists.push(url);
		});
		users_json.users[user_index].parental.blacklist = blacklists;

		//timeblock
		var timeblock_table = editor.find('table.timeblock-table');
		var timeblocks = {};
		timeblock_table.find('tbody tr').each(function() {
			var row = $(this);
			var day_code = row.attr('day');
			timeblocks[day_code] = [];
			row.find('td.selected').each(function() {
				timeblocks[day_code].push(parseInt($(this).attr('x'), 10));
			});
		});

		users_json.users[user_index].parental.timeblock = timeblocks;

		li.find('a.btn-expand-editor').removeClass('expanded');
		editor.slideUp(function() {
			save_users_json();
		});

	});

	$(document).on('click', '.parental-editor .btn-cancel-parental-options', function(event) {
		var li = $(this).parents('li');
		var editor = li.find('.parental-editor');
		li.find('a.btn-expand-editor').removeClass('expanded');
		editor.slideUp(function() {
			editor.remove();
		});
	});

};

var dashboard_page_load = function()
{
	var page = $('section#page-dashboard');
	var tile_menu = page.find('.tile-menu');

	$.getJSON('json/menu.json', function(data) {
		$.each(data.items, function(k, item) {
			console.log(item);
			tile_menu.append(templates['tile-menu'](item));
		});
	});
	
};
