//shim: module exports to absorb any export commands
window.module = {
	exports: undefined
};

window.require = function(module){
	let name = module.split('/')[0];
	return window[`${name.slice(0,1).toUpperCase()}${name.slice(1)}`];
};