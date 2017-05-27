
class Util {
	
	static trimFloat(n, limit) {
		limit = limit || 3;
		return parseFloat(n.toFixed(limit));
	}
}

module.exports = Util