//
var Views = {
	
	Login: Backbone.View.extend({
		el: '#primary',
		tagName: "div",
		id: "page-login",
		render: function() {
			this.$el.html(templates['page-login']());
		}
	}),

	Dashboard: Backbone.View.extend({
		el: '#primary',
		tagName: "div",
		id: "page-dashboard",
		render: function() {
			this.$el.html(templates['page-dashboard'](get_current_user()));
			loaders.dashboard();
		}
	}),

	Wifi: Backbone.View.extend({
		el: '#primary',
		tagName: "div",
		id: "page-wifi",
		render: function() {
			this.$el.html(templates['page-wifi']());
			var form = $('form#wifi-form');
			form.append(templates['wifi-form']());
			loaders.wifi_form(form, 'wifi');
		}
	}),

	ConnectedDevices: Backbone.View.extend({
		el: '#primary',
		tagName: "div",
		id: "page-connected-devices",
		render: function() {
			this.$el.html(templates['page-connected-devices']());
			loaders.connected();
		}
	}),

	Usage: Backbone.View.extend({
		el: '#primary',
		tagName: "div",
		id: "page-usage",
		render: function() {
			this.$el.html(templates['page-usage']());
			loaders.usage();
		}
	}),

	ParentalControls: Backbone.View.extend({
		el: '#primary',
		tagName: "div",
		id: "page-parental-controls",
		render: function() {
			this.$el.html(templates['page-parental-controls']());
			loaders.parental();
		}
	}),

	Firewall: Backbone.View.extend({
		el: '#primary',
		tagName: "div",
		id: "page-firewall",
		render: function() {
			this.$el.html(templates['page-firewall']());
			loaders.firewall();
		}
	}),

};

var loaders = {

	dashboard: function()
	{
		console.log('a');

		get_users_json(function(response) {

			var data_usage = {
				labels: [''],
				series: []
			};

			var total_dsoctets = 0;

			$.each(response.users, function(i, user) {
				var arr = {
					data: [{
						value: 0,
						meta: user.firstName
					}]};

				var dsoctets = 0;
				$.each(user.devices, function(j, device) {
					dsoctets += device.dsoctets;
				});


				total_dsoctets += dsoctets;

				//console.log(dsoctets);

				arr.data[0].value = dsoctets;
				data_usage.series.push(arr);

			});

			var make_nice_value = function(mb)
			{
				return mb < 1000 ? mb.toFixed(2)+'MB' : (mb / 1024).toFixed(2)+'GB';
			};

			var total_mb = total_dsoctets / 1024 / 1024;

			/*
				cap at the next nearest MB/GB
			*/
			var tens = Math.ceil(total_mb),
				cap_mb = Math.pow(10, tens.toString().length),
				unused_dsoctets = (cap_mb * 1024 * 1024) - total_dsoctets,
				unused_mb = unused_dsoctets / 1024 / 1024;

			data_usage.series.push(
				{
				data: [{
					value: unused_dsoctets,
					meta: 'Available'
				}]}
			);

			$('span#total-dsoctets').text(make_nice_value(total_mb));
			$('span#bandwidth-cap').text(make_nice_value(cap_mb));

			//console.log(data_usage);

			new Chartist.Bar('.usage-chart', data_usage, {
				fullWidth: true,
				stackBars: true,
				chartPadding: 0,
				horizontalBars: true,
				//showLabel: false,
				showGrid: false,
				showAxis: false,
				axisX: {
					showLabel: false,
					showGrid: false
				},
				axisY: {
					showLabel: false,
					showGrid: false
				},
				plugins: [
					Chartist.plugins.tooltip({

						tooltipFnc: function(meta, value) {
							var mb = value / 1024 / 1024;
							var nice_value = mb < 1000 ? mb.toFixed(2)+'MB' : (mb / 1024).toFixed(2)+'GB';
							return meta+': '+nice_value;
						}
					})
				]
			}).on('draw', function(data) {
				if(data.type === 'bar') {
					data.element.attr({
						style: 'stroke-width: 45px'
					});
				}
			});
		});
},

	wifi_form: function(form, service_slug) {
		if(form === undefined || service_slug === undefined) return false;

		var service_id = 1;//current_device.services[service_slug];

		if(service_id !== undefined) {
			form.attr('service-id', service_id);
			var security_mode_select = form.find('select[name="SecurityMode"]');
			$.each(wifi_security_modes, function(key, val) {
				security_mode_select.append('<option value="'+key+'">'+val+'</option>');
			});

			api_call('wifi', '', '', function(response) {
				if(response.returnValue.parameters) {
					$.each(response.returnValue.parameters, function(i, parameter) {
						var input = form.find('[name="'+parameter.name+'"]');
						if(input.length > 0) {
							if(input.attr('type') === 'checkbox') {
								var check = parseInt(parameter.value, 10) === 1 ? 1 : 0;
								input.prop('checked', check).change();
							} else {
								input.val(parameter.value);
							}
						}
					});
					if(response.returnValue.subGroups) {
						wifi_subgroups = JSON.parse(JSON.stringify(response.returnValue.subGroups));
						$.each(response.returnValue.subGroups, function(group_index, group) {
							if(group.dependsOnParameters[0].value) {
								$.each(group.dependsOnParameters[0].value, function(j, val) {
									wifi_groups[val] = group_index;
								});
							}
						});
					}
					actions.change_security_mode(form.find('select[name="SecurityMode"]'));
					form.fadeIn('fast');
				}
			});

		} else {
			flash_message('Unable to load WiFi settings.');
		}
	},

	parental: function() {
		var user_list = page.find('.users-list');

		get_users_json(function(users_json) {
			$.each(users_json.users, function(k, item) {
				item.index = k;
				user_list.append(templates['parental-users-list-item'](item));
			});
		});
	},

	connected: function() {
		var users_list = page.find('ul.network-users-list');
		var unknown = 0;

		$({}).queue(function(next) {
			}).queue(function(next) {
		});

		get_users_json(function(data) {

			var unknown_vendors = [];
			var guest_index;

			$.each(data.users, function(i, user) {
				user.index = i;

				if(user.name === 'Guest') user.type = 'guest';
				if(user.photo === undefined || user.photo === '') user.photo = 'images/default-profile.png';

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
	},


	usage: function() {

		$({}).queue(function(next) {
			get_users_json(function() {
				next();
			});
		}).queue(function(next) {
			get_usage(function() {
					
				//charting time
				var chart_data = [];

					$.each(users_usage, function(i, device) {
					user_index = index_of_with_attr(users_json.users[0].devices, 'name', user.profiles.firstName);
					//scrubber
					var item = {
						name: user.name,

				// $.each(users_usage, function(i, user) {
				// 	user_index = index_of_with_attr(users_json.users, 'name', user.name);
				// 	//scrubber
				// 	var item = {
				// 		name: user.name,
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
	},

	firewall: function() {

		var rules_table = page.find('table.firewall-rules');
		var port_table = page.find('table.firewall-redirects');
		var raw_rules = '';

		$(document).on('click', '#btn-add-firewall-rule', function(event) {
			event.preventDefault();
			var form = $('#rule-editor-firewall');
			form.html(templates['firewall-rule-editor']());
			form.slideDown();

			dropdown.load('#col-allow-block', firewall_form['allow-block']);

			//dropdown.load('#col-in-out', firewall_form['in-out']);
			typeahead_input.load('#col-port-app', firewall_form['app-ports-combined'], {
				placeholder: 'Port/App'
			});

			var device_arr = [];
			get_users_json(function(data) {
				$.each(data.users, function(i, user) {
					$.each(user.devices, function(j, device) {
						device_arr.push(device.description);
					});
				});
				typeahead_input.load('#col-ip', device_arr, {
					placeholder: 'Device name'
				});
			});

		});

	},

};

var view_load_wrapper = function(v) {
	var pane = $('#primary');

	//generic
	pane.find('input[data-toggle="toggle"]').each(function() {
		$(this).bootstrapToggle();
	});

};

var AppRouter = Backbone.Router.extend({
	routes: {
		'': 'page_dashboard',
		//'devices': 'page_devices',
		'login': 'page_login',
		'wifi': 'page_wifi',
		'firewall': 'page_firewall',
		'connected-devices': 'page_connected_devices',
		'parental-controls': 'page_parental_controls',
		'usage': 'page_usage',
		'debug': 'page_debug'
	},
	views: {},
	route: function(route, name, callback) {
		var router = this;
		if (!callback) callback = this[name];

		var f = function() {
			callback.apply(router, arguments);
		};
		return Backbone.Router.prototype.route.call(this, route, name, f);
	},
	initialize: function() {
		var views = {};
		$.each(Views, function(key, view) {
			views[key] = new view();
		});
		this.views = views;
	},
	load_view: function(v) {
		//ghetto middleware
		flash_message_close();
		if(v !== 'Login') {
			if(sessionStorage.token === '' || sessionStorage.token === undefined) {
				this.navigate('login', true);
				return false;
			} else {
				actions.logged_in();
			}
		}
		this.views[v].render();
		view_load_wrapper(v);
	},
	//initial view
	page_login: function() {
		this.load_view('Login');
		//this.view_index.render();
		//this.views.Login.render();
	},
	page_dashboard: function() {
		this.load_view('Dashboard');
	},
	page_wifi: function() {
		this.load_view('Wifi');
	},
	page_connected_devices: function() {
		this.load_view('ConnectedDevices');
	},
	page_parental_controls: function() {
		this.load_view('ParentalControls');
	},
	page_usage: function() {
		this.load_view('Usage');
	},
	page_firewall: function() {
		this.load_view('Firewall');
	}
});