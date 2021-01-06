
var App,
	page,
	templates = {},
	users_json,
	users_quota,
	users_usage,
	refresh_clock;

var users = [

	 {
	 	username: 'tip',
	 	password: 'password',
	 	subscriberId: 'tip001',
	 	deviceModel: 'wifiCPE001',
	 	deviceSerial: 'A0B0C0D1E2F1',
	 	advanced: true
	 },


];

var menu_items = [
	{
		"id": "wifi",
		"title": "WiFi",
		"url": "#wifi",
		"icon": "fa-wifi",
		"tile-color": "white",
		//"status-text": "on",
		//"mode-text": "5GHz"
	},
	{
		"id": "connected-devices",
		"title": "Users and Devices",
		"url": "#connected-devices",
		"icon": "fa-users",
		"tile-color": "white",
		"status-text": "",
		"mode-text": ""
	},
	{
		"id": "parental-controls",
		"title": "Parental Controls",
		"url": "#parental-controls",
		"icon": "fa-child",
		"tile-color": "white",
		"status-text": "",
		"mode-text": ""
	},
	{
		"id": "usage",
		"title": "Usage",
		"url": "#usage",
		"icon": "fa-bar-chart",
		"tile-color": "white",
		"status-text": "",
		"mode-text": ""
	},
	{
		"id": "firewall",
		"title": "Firewall",
		"url": "#firewall",
		"icon": "fa-shield",
		"tile-color": "white",
		//"status-text": "on",
		//"mode-text": ""
	}
];

var wifi_security_modes = {
	"Disabled":"Disabled",
	"WEP-Open":"WEP-Open",
	"WEP-Shared":"WEP-Shared",
	"TKIPEncryption":"WPA-PSK(TKIP)",
	"AESEncryption":"WPA2-PSK(AES)",
	"TKIPandAESEncryption":"Mixed WPA/WPA2",
	"EAPAuthentication":"Enterprise (802.1x)"
};

var wifi_groups = {},
	wifi_subgroups;

var flash_timeout;

var firewall_form = {
	'allow-block': {
		'id': 'allow-block',
		'choices': [
			{
				'class': 'style-danger',
				'value': 'Block',
				'label': '<span class="fa fa-ban"></span> Block',
			},
			{
				'class': 'style-success',
				'value': 'Allow',
				'label': '<span class="fa fa-check"></span> Allow',
			}
		]
	},
	'in-out': {
		'id': 'in-out',
		'choices': [
			{
				'class': 'style-info',
				'value': 'Incoming',
				'label': '<span class="fa fa-check"></span> Incoming',
			},
			{
				'class': 'style-dark',
				'value': 'Outgoing',
				'label': '<span class="fa fa-ban"></span> Outgoing',
			},
			{
				'class': 'style-gray',
				'value': 'Both',
				'label': '<span class="fa fa-ban"></span> Both',
			}
		]
	},
	'app-ports': [
		{
			'port': 80,
			'app': 'HTTP'
		}, {
			'port': 443,
			'app': 'SSL'
		}, {
			'port': 6881,
			'app': 'Bittorrent'
		}, {
			'port': 6882,
			'app': 'Bittorrent'
		}, {
			'port': 6883,
			'app': 'Bittorrent'
		}, {
			'port': 6884,
			'app': 'Bittorrent'
		}, {
			'port': 6885,
			'app': 'Bittorrent'
		}
	],
	'app-ports-combined': [
		'FTP (21)', 'SSH (22)', 'HTTP (80)', 'HTTP (81)', 'SSL (443)', 'Bittorrent 6881', 'Bittorrent 6882', 'Bittorrent 6883', 'Bittorrent 6884', 'Bittorrent 6885'
	]
};

var sample_data_usage = {
	labels: [''],
	series: [
		{
			data: [{
				value: 27.2,
				meta: 'Melanie'
			}]},
		{
			data: [{
				value: 20.3,
				meta: 'TIP User',
			}]
		},
		{
			data: [{
				value: 10.7,
				meta: 'Samantha'
			}]
		},
		{
			data: [{
				value: 9,
				meta: 'April'
			}]
		},
		{
			data: [{
				value: 2.1,
				meta: 'Guest'
			}]
		},
		{
			data: [{
				value: 20.8,
				meta: 'Unused'
			}]
		}
	]
};

var sample_usage_data = {
	labels: ['TIP User', 'April', 'Samantha', 'Melanie'],
	series: [35, 10, 15, 20]
};