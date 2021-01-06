//
var login_url = 'http://127.0.0.1:8000/users/login';
var tipsdk_user = 'http://127.0.0.1:3030/subscriber';
var user_profile = '?profile=';

var actions = {

		login: function() {
			flash_message_close(true);
			var form = $('#login-form');
			var username = $('#username').val();
			var password = $('#password').val();

			event.preventDefault();

			$.ajax({
				type: "POST",
				contentType: "application/json",
				dataType: "json",
				url: login_url,
				data: JSON.stringify({
					username: username,
					password: password
				}),

				success: function(response, status, request) {
					if(request.getResponseHeader('Auth') !== undefined || '') {
						sessionStorage.token = request.getResponseHeader('Auth');
						sessionStorage.current_user = response;
						set_current_user(response);
						set_route('#/');
						//this.logged_in();

					} else {
						flash_message('Unkown Error');
						return false;
					}
				}


			});
		},


	/*
		perform this when user is already logged in
	*/
	logged_in: function() {
		$('#main-navigation-toggle').show();
	},

	change_security_mode: function(select) {
		var selection = select.val(),
			form = select.parents('form'),
			fieldset = form.find('fieldset.passphrase');
				
		fieldset.html('');
		
		if(wifi_groups[selection] !== undefined) {
			var subgroup_index = wifi_groups[selection],
				subgroup = wifi_subgroups[subgroup_index];

			if(subgroup.parameters) {
				$.each(subgroup.parameters, function(i, parameter) {
					var field_group = generate_input_group('text', {
						'type': parameter.dataType.type.toLowerCase(),
						'label': parameter.friendlyName,
						'name': parameter.name,
						'value': parameter.value,
						'label_class': 'col-sm-4',
						'control_class': 'col-sm-8'
					});
					fieldset.append(field_group);
				});
				fieldset.slideDown('fast');
			}
		}
	},

	logout: function() {
		sessionStorage.removeItem('token');
		sessionStorage.removeItem('current_user');
		current_device = undefined;
		$('header .current-device').fadeOut('fast');
		$('header .navbar-nav').slideUp(function() {
			$(this).find('span.username').text('');
		});
		set_route('login');
		flash_message('Logged out successfully.', 'warning');
	}

};

/*
	Document ready
	Runs once everything is loaded in the DOM
*/
$(document).ready(function() {

	//check if user exists
	if (sessionStorage.current_user !== undefined && sessionStorage.token !== undefined) {
		var user = JSON.parse(sessionStorage.current_user);
		set_current_user(user);
	}

	//load templates
	$('script[id^="tpl-"]').each(function(item) {
		var template_id = $(this).attr('id').substr(4);
		templates[template_id] = Handlebars.compile($(this).html());
	});

	page = $('#primary');

	App = new AppRouter();

	Backbone.history.start();

	//binds
	$(document).on('submit', '#login-form', function(event) {
		actions.login();
	});

	$(document).on('click', '#btn-logout', function(event) {
		event.preventDefault();
		actions.logout();
	});

	$(document).on('click', '#flash-message .close', function(event) {
		flash_message_close();
	});

	$(document).on('change', 'form select[name="SecurityMode"]', function(event) {
		actions.change_security_mode($(this));
	});

	$(document).on('click', '#btn-add-network-users', function(event) {
		event.preventDefault();
		var users_list = page.find('ul.network-users-list');
		if (users_list.find('.add-row').length === 0) {
			users_list.append(templates['network-users-list-add-row']());
			users_list.find('.add-row').slideDown();
		}
	});

	$(document).on('click', '#btn-submit-users-list', function(event) {
		event.preventDefault();
		var toggle = $(this);

		var target_table = toggle.parents('.users-list');
		var form = target_table.find('.add-row');
		var new_user = {
			firstName: form.find('input[name="firstName"]').val(),
			lastName: form.find('input[name="lastName"]').val(),
			photo: 'images/default-profile.png'
		};
		new_user.name = (new_user.firstName+new_user.lastName).toLowerCase();

		new_user.index = target_table.children().length; 

		target_table.append(templates['network-users-list-item'](new_user));

		//save to TIP SDK
		var new_profile = {
			'firstName': new_user.firstName,
			'lastName': new_user.lastName,
			'name': new_user.name,
			'allowUnclassified': true,
			'ranking': 0,
			'password': 'password'
		};

		orc_put_profile(new_profile, '', function(response) {
			form.remove();
		}, function(response) {
			flash_message('Error saving new profile (TIP SDK)');
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
		if (user_index !== undefined) {
			if (parental_setting_type !== '' && parental_setting_type !== undefined)
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
		if (btn.hasClass('expanded')) {
			btn.removeClass('expanded');
			li.find('.parental-editor').slideUp();
		} else {
			var user = users_json.users[li.attr('item-index')];
			var parental_editor = li.find('.parental-editor');

			btn.addClass('expanded');

			if (parental_editor.length === 0) {
				li.append(templates['parental-users-editor']());
				parental_editor = li.find('.parental-editor');

				//rating!
				if (user.ranking !== undefined) parental_editor.find('select[name="pagerating"]').val(user.ranking);

				//blacklist!
				if (user.parental.blacklist.length > 0) {
					parental_editor.find('.blacklists').append(templates['parental-blacklist-input'](user.parental.blacklist));
				}

				//quota!
				parental_editor.find('.quota-controls input').val(convert_b_to_mb(user.parental.quotaMB));

				//timeblock!
				var days = get_timeblock_day_code();

				for (var y = 1; y <= 7; y++) {
					var row = $('<tr y="' + y + '" day="' + days[y - 1].code + '"><th>' + days[y - 1].day + '</th></tr>');
					for (var x = 1; x <= 48; x++) {
						row.append('<td x="' + x + '"></td>');
					}
					parental_editor.find('table.timeblock-table tbody').append(row);
				}

				//header times
				for (var h = 1; h <= 24; h++) {
					parental_editor.find('table.timeblock-table thead tr').first().append('<th colspan="2">' + h + '</th>');
				}

				//populate existing timeblock slots
				$.each(user.parental.timeblock, function(key, arr) {
					$.each(arr, function(i, num) {
						parental_editor.find('table.timeblock-table tbody tr[day="' + key + '"] td[x="' + num + '"]').addClass('selected');
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

		if (event.shiftKey && last_cell.length === 1) {
			var last_x = last_cell.attr('x');
			var last_y = last_cell.parent().attr('y');
			var last_state = last_cell.hasClass('selected');
			var low_x = last_x,
				low_y = last_y,
				hi_x = new_x,
				hi_y = new_y;

			if (last_x > new_x) {
				low_x = new_x;
				hi_x = last_x;
			}
			if (last_y > new_y) {
				low_y = new_y;
				hi_y = last_y;
			}

			for (var yi = low_y; yi <= hi_y; yi++) {
				for (var xi = low_x; xi <= hi_x; xi++) {
					//console.log(yi+', '+xi);
					var c = table.find('tr[y="' + yi + '"] td[x="' + xi + '"]');
					if (last_state) c.addClass('selected');
					else c.removeClass('selected');
				}
			}

			//break shift click
			table.find('td.click').removeClass('click');

			return true;
		}

		if (cell.hasClass('selected')) {
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
		var uuid = li.attr('user-uuid');

		//rating
		var new_rating = editor.find('.rating-controls select').first().val();
		var rating_int = parseInt(new_rating, 10);
		//users_json.users[user_index].parental.pagerating = parseInt(new_rating, 10);

		var profile = {
			"firstName"         : user.firstName,
			"lastName"          : user.lastName,
			"name"              : user.name,
			"password"          : user.password,
			"ranking"           : rating_int,
			"allowUnclassified" : user.allowUnclassified
		};

		orc_put_profile(profile, '', function(response) {
			li.find('a.btn-expand-editor').removeClass('expanded');
			editor.slideUp(function() {
				//save_users_json();
			});
		}, function(response) {
			flash_message('Error saving profile');
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

	$(document).on('click', '.editor-dropdown a.toggle', function(event) {
		var btn = $(this),
			parent = btn.parent(),
			dropdown = parent.find('ul.dropdown');
		parent.toggleClass('open');
	});

	$(document).on('click', '.editor-dropdown ul.dropdown li a', function(event) {
		var btn = $(this),
			parent = btn.parents('.editor-dropdown'),
			toggle = parent.find('a.toggle'),
			dropdown = parent.find('ul.dropdown');
		toggle.attr({
			'class': 'toggle ' + btn.attr('class'),
			'value': btn.attr('value')
		}).html(btn.html());
		parent.toggleClass('open');
	});

	$(document).on('click', 'body', function(event) {
		if (!$('.editor-dropdown').is(event.target) && $('.editor-dropdown').has(event.target).length === 0 && $('.open').has(event.target).length === 0) {
			$('.editor-dropdown').removeClass('open');
		}
	});

	$(document).on('click', 'a#btn-save-firewall-rule', function(event) {
		var editor = $('#rule-editor-firewall'),
			form = $('#rule-editor-firewall');
		var rule = {
			'method': dropdown.validate('#col-allow-block'),
			'port': typeahead_input.validate('#col-port-app'),
			'device': typeahead_input.validate('#col-ip')
		};
		if (editor.find('.has-error').length === 0) {
			$('.firewall-rules tbody').append(templates['firewall-rule-row'](rule));
			form.slideUp(function() {
				$(this).html('');
			});
		}
	});

});

var refresh_dhcp_leases = function() {
	$.get('lib/dhcp-leases.php', function(data) {

		var guest_li = $('ul.network-users-list li.type-guest');

		var data_lines = data.split(/\r\n|\n/);
		var guest_devices = [];
		for (var i = 0; i < data_lines.length - 1; i++) {
			var device_data = data_lines[i].split(' ');

			//device only gets added if it doesn't exist
			if ($('ul.user-devices-list li[mac="' + device_data[1] + '"]').length === 0) {
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

var start_refresh_clock = function() {
	window.refresh_clock = window.setInterval(refresh_dhcp_leases, 5000);
};

var update_users_json_network_map = function() {
	//a check to avoid trying to save mid drag...
	if ($('body').hasClass('drag-active')) return false;

	$('.network-users-list > li').each(function() {
		var user_li = $(this);
		var name = user_li.find('.user-name').text();
		if (name === '' || name === undefined) return;

		//look for our user
		user_index = index_of_with_attr(users_json.users, 'name', name);
		if (user_index === false) //crud, we have to add this new person
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


// Derive My Home from SDK supplied data
// 
var get_users_json = function(callback) {
	$.ajax({
		type: "GET",
		url: tipsdk_user + user_profile + current_user.username,
		contentType: "text/plain",
		success: function(response) {
			//console.log(response);
			if(response[0].profiles === undefined) {
				flash_message('Error: No Profiles Found');
				return false;
			}

			//re-assemble the JSON to fit with expected structure
			var re_users_json = {
					'users': []
				},
				user_devices = [];

			// the parental page currently expects these values for each user...
			parental_default = JSON.stringify({
				"disabled": false,
				"tracked": false,
				"pagerating": 7,
				"enabled": {
					"whitelist": false,
					"blacklist": false,
					"timeblock": false,
					"quotaMB": false
				},
				"whitelist": [],
				"blacklist": [],
				"timeblock": {},
				"quotaMB": 0
			});

			var all_devices = [];

			$.each(response, function(i, r) {

				current_user.uuid = r.uuid;

				$.each(r.profiles, function(j, profile) {
					var user_profile = profile;

					user_profile.devices = [];
					user_profile.parental = JSON.parse(parental_default);

					re_users_json.users.push(user_profile);
				});

				try {
					$.each(r.network.devices, function(i, d) {
						all_devices.push(d);
					});
				} catch(err) {
				}
			});

			var guest_index = index_of_with_attr(re_users_json.users, 'name', 'Guest');
			if(guest_index === false) {
				re_users_json.users.push({
					'devices': [],
					"firstName": "Guest",
					"lastName": "",
					"name": "Guest",
					"password": "password",
					"ranking": 6,
					"allowUnclassified": true,
					"parental": JSON.parse(parental_default)
				});
				guest_index = re_users_json.users.length - 1;
			}

			//store devices into the user
			$.each(all_devices, function(i, device) {
				//can't leave this attr undefined
				device.type = 'generic';
				if(device.description === undefined) device.description = device.mac;
				var profile_index = index_of_with_attr(re_users_json.users, 'name', device.profile);
				if(device.profile === null) re_users_json.users[guest_index].devices.push(device);
				else if(profile_index !== false) re_users_json.users[profile_index].devices.push(device);
			});

			//set global
			window.users_json = re_users_json;

			if (typeof(callback) === typeof(Function)) {
				callback(re_users_json);
			}
				
		}
	});
};
   

// changed to align with My Home SDK 
var get_users_json_device = function(mac_address) {
	var result;
	$.each(users_json.network.devices, function(i, user) {
		$.each(user.network.devices, function(j, device) {
			if (device.mac === mac_address) {
				result = device;
				return false;
			}
		});
		if (result) return result;
	});

	return result;
};

// change to align with SDK
//
var save_users_json = function(callback) {
		//where the guest account resides in that array
		var guest_index = index_of_with_attr(users_json.profiles, 'name', 'Guest');


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
				console.log('Recordupdated');
			},
			error: function() {
				console.log('Record update error');
			}
		});

	});
};

var get_usage = function(callback) {
	
	$.ajax({
				type: "GET",
				url: tipsdk_user + user_profile + current_user.username,
				contentType: "text/plain",
				success: function(response) {
					if (response[0].profiles === undefined) {
						flash_message('Error: No Profiles Found');
						return false;
					}
					// align orchestrator json to SDK

					if (typeof(callback) === typeof(Function)) {
						var users_json = {
								'users': [
									response[0].profiles
								]
							},
							users = [];

						$.each(response[0].network.devices, function(i, device) {
							console.log(device);
							var user_index = index_of_with_attr(users, 'users', device.mac);
							var sent = parseInt(device.usoctets, 10);
							var received = parseInt(device.dsoctets, 10);
							if (isNaN(sent)) sent = 0;
							if (isNaN(received)) received = 0;	
							if (user_index !== false) {
								users[user_index].sent += sent;
								users[user_index].received += received;
							} else {
								var user = {
									name: device.mac,
									sent: sent,
									received: received,
								};
							users.push(device);
							}						
						});
						users_usage = users;
						if (typeof(callback) == typeof(Function)) {
							callback(users_quota);
						}
					}
				}
			});			
	};

var get_timeblock_day_code = function() {
	return [{
		code: 's',
		day: 'Sun'
	}, {
		code: 'm',
		day: 'Mon'
	}, {
		code: 't',
		day: 'Tue'
	}, {
		code: 'w',
		day: 'Wed'
	}, {
		code: 'r',
		day: 'Thu'
	}, {
		code: 'f',
		day: 'Fri'
	}, {
		code: 'y',
		day: 'Sat'
	}];
};

var firewall_page_load = function() {
	var page = $('section#page-firewall');
	var rules_table = page.find('table.firewall-rules');
	var port_table = page.find('table.firewall-redirects');
	var raw_rules = '';

	$(document).on('click', '.toggle-rule-btn', function(event) {

		event.preventDefault();

		var toggle = $(this),
			index = toggle.parents('tr').attr('rule-index'),
			value = 1,
			firewall_type = toggle.attr('firewall-type'),
			new_class = 'enabled';

		//status is based on the class
		if (toggle.find('span').hasClass('enabled')) //enable; so we disable it
		{
			value = 0;
			new_class = 'disabled';
		}
		var uci_attr = 'firewall.@' + firewall_type + '[' + index + '].enabled';
		var command = 'uci set ' + uci_attr + '=' + value;

		tip_ajax(command, null, function(response) {
			tip_ajax('uci commit firewall;/etc/init.d/network restart');
			toggle.find('span').attr('class', 'fa ' + new_class);
		});

	});

	$(document).on('click', '.delete-rule-btn', function(event) {
		event.preventDefault();
		var toggle = $(this),
			parent_row = toggle.parents('tr'),
			parent_tbody = parent_row.parent(),
			index = parent_row.attr('rule-index'),
			firewall_type = toggle.attr('firewall-type');

		var uci_attr = 'firewall.@' + firewall_type + '[' + index + ']';
		var command = 'uci delete ' + uci_attr;

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
		if (port_table.find('tbody tr.add-row').length === 0) {
			port_table.find('tbody').append(templates['firewall-redirect-add-row']());
			port_table.find('tr.add-row').slideDown();
		}
	});

	$(document).on('click', '#btn-submit-firewall-rule', function(event) {
		event.preventDefault();
		var toggle = $(this);
		var firewall_type = toggle.attr('firewall-type');
		var target_table = toggle.parents('table');
		var form = target_table.find('tr.add-row');
		var rule;
		if (firewall_type == 'rule') {
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
		var command = 'uci add firewall ' + firewall_type + ';';
		$.each(rule, function(k, v) {
			if (v.indexOf(' ') >= 0) v = "'" + v + "'";
			command += "uci set firewall.@" + firewall_type + "[-1]." + k + "=" + v + ";";
		});
		tip_ajax(command, null, function(response) {
			tip_ajax('uci commit firewall;/etc/init.d/network restart');
			form.remove();
			rule.index = target_table.find('tbody > tr').length; //this is a big assumption
			rule.class = 'enabled';
			target_table.find('tbody').append(templates['firewall-' + firewall_type + '-row'](rule));
		});
	});

};

var reindex_table_rows = function(selector, attr) {
	if (attr === undefined) attr = 'item-index'; //let's use this from now on
	$(selector).find('tr').each(function(i, row) {
		$(row).attr(attr, i);
	});
};

var tip_update = function(node) {
	if (node.type != "checkbox")
		return;
	var key = node.name;
	var value = node.checked ? 1 : 0;
	var command = 'uci set ' + key + '=' + value;
	alert(command);
	tip_ajax(command, null, function(response) {
		alert(response);
	});
};

/*
	call to our uci.php file which does some fetching

	command (str): our required str command
	params (object): additional parameters in JS object {}
	callback (function): what to do with the response
*/
var tip_ajax = function(command, params, callback) {

	if (command === undefined || command === '') return false;

	if (typeof params === 'object') {
		params = {
			str: command
		};
	} else {
		params = {};
		params.str = command;
	}

};

var api_call = function(command, method, params, callback) {
	if (command === undefined || command === '') return false;

	if (method === undefined || method === '')
		method = 'GET';

	if (typeof params !== 'object') {
		params = {};
	}

	var rest_url = 'api/' + command;
	if (command === 'wifi') rest_url = 'json/' + command;

	$.ajax({
		type: method,
		dataType: 'JSON',
		url: rest_url,
		data: params,
		success: function(response) {
			if (typeof(callback) === typeof(Function)) {
				callback(response);
			}
		},
		error: function(error) {
			//this shouldn't happen... I hope ~_~
			//salvage
			if (error.status === 200) {
				try {
					var text = error.responseText.replace(/(\r\n|\n|\r)/gm, "");
					text = text.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,[,\s]*,/g, ',');
					//console.log(text);
					var data = JSON.parse(text);
					if (typeof(callback) === typeof(Function)) {
						callback(data);
					}
				} catch (err) {}
			} else {
				alert(error.status + ': ' + error.statusText);
			}
		}
	});
};

var parse_firewall_rules = function(raw_rules) {
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
		if (rule !== '') {
			var kv = rule.split('=');
			var key_parts = kv[0].split('.');
			var key_cat = key_parts[1].replace(/[^a-z]/gi, '');
			var key_index = key_parts[1].replace(/[^0-9]/gi, '');
			var key_attribute = key_parts[2];

			//re-assemble our object
			if (key_attribute !== undefined) {
				if (firewall[key_cat][key_index] === undefined)
					firewall[key_cat][key_index] = {};
				firewall[key_cat][key_index][key_attribute] = kv[1];
			}
		}
	});

	return firewall;
};