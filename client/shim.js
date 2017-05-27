//shim: module exports to absorb any export commands
window.module = {
	exports: undefined
};


//note: this expects the file export to be a class and tries to recover gracefully if it is a classic object
window.require = function(module){
	
	let slices = module.split('/');
	
	let name = module.split('/')[slices.length-1];
	
	let moduleName = `${name.slice(0,1).toUpperCase()}${name.slice(1)}`;
	
	try {
		return eval(moduleName);
	}catch(e) {
		console.warn('ClientSide require error', e);
		return window[moduleName];
	}
};