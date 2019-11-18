function YouAndI(prefix, onConnect, onMessage, onDisconnect) {

	this.prefix = prefix;
	this.socket = null;
	this.onConnect = onConnect;
	this.onMessage = onMessage;
	this.onDisconnect = onDisconnect;

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
			this.socket.close();
		}
		this.socket = null;
		if(this.onDisconnect) this.onDisconnect();
	}

	this.connect = function () {
		this.socket = new WebSocket('ws://hub.togetherjs.com/hub/youandi'+prefix+'_'+this.getSessionId());

		this.socket.addEventListener('open', function (event) {
				 console.log(event);
				 if(this.onConnect) this.onConnect(event);
	   });

		this.socket.addEventListener('message', function (event) {
				 var data = JSON.parse(event.data);
				 console.log('Message from server ', data);
				 if(this.onMesssage) this.onMesssage(data);
	   });
	};


}
