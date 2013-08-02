var requirejs;
superdesk.version = 3 ;// = {Version};
superdesk.bower = { directory: '../bower_components'};
superdesk.runner = function() {
	requirejs = {
		baseUrl: this.baseUrl,
		paths: {
			'components': superdesk.bower.directory
		},
		urlArgs: 'version=' + this.version
	}
	this.loadJs( superdesk.bower.directory + '/requirejs/require').setAttribute('data-main','main');
}
superdesk.runner();