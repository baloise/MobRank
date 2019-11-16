function YouAndI(prefix) {

	this.prefix = prefix;
	this.socket = null;
	this.uuid = function () {
	  function s4() {
	    return Math.floor((1 + Math.random()) * 0x10000)
	      .toString(16)
	      .substring(1);
	  }
	  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
	    s4() + '-' + s4() + s4() + s4();
	};

	this.getSessionId = function () {
	    return (document.URL.split('#').length > 1) ? document.URL.split('#')[1] : null;
	};

	this.hasSession = function () {
	    return this.getSessionId() != null;
	};

	this.setSessionId = function (id) {
		window.history.pushState(id, null, "#"+id)
		return id;
	};

	this.newSession = function () {
		return this.setSessionId(this.uuid());
	};

	this.disconnect = function () {
		if(this.socket != null) {
			socket.close();
		}
		this.socket = null;
	}

	this.connect = function () {
		this.socket = new WebSocket('ws://hub.togetherjs.com/hub/youandi'+prefix+'_'+this.getSessionId());

		this.socket.addEventListener('open', function (event) {
	       console.log(event);
	   });

		this.socket.addEventListener('message', function (event) {
	       console.log('Message from server ', JSON.parse(event.data));
	   });
	};


}
