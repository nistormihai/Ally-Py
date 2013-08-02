require.config({
	paths: {
		angular: superdesk.bower.directory + '/angular/angular.min',
		jquery: superdesk.bower.directory + '/jquery/jquery.min',
		jed: superdesk.bower.directory + '/jed/jquery',
	},
	shim: {
		angular: {
			deps: ['jquery'],
			exports: 'angular'
		}
	}
})
define(['superdesk'], function(){
	//console.log('main');
});