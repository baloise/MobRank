function YouAndI(prefix) {

	this.prefix = prefix;
	this.socket = null;
	this.yai = this;
	this.isLeader = false;
	this.createdAt = new Date().getTime();
	this.clusterState = {};
	this.listeners = {
		clusterChange : [],
	  connect : [],
		onboard : [],
		message : [],
	  disconnect : [],
	}

	this.addListener = function (event, listener) {
		  this.listeners[event].push(listener);
			return this;
	};

	this.fireEvent = function (eventType, event) {
		  this.listeners[eventType].forEach(listener => listener(event));
	};

	window.addEventListener('beforeunload', function (event) {
 		yai.disconnect();
	});

	this.arrayRemove = function (arr, value) {
		return arr.filter(function(e){
				return e != value;
		});
	};

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

	this.send = function (message) {
		if(this.socket != null) {
			if(!message.type || !message.type.startsWith("yai_")) {
					if(this.isLeader) {
						yai.fireEvent("message" , message);
						message = {"type" : "yai_message", "data" : message};
					} else {
						message = {"type" : "yai_cast", "data" : message};
					}
			}
			this.socket.send(JSON.stringify(message))
		} else {
			return false;
		}
	};

	this.disconnect = function () {
		if(this.socket != null) {
			this.send({"type" : "yai_bye" ,"createdAt" : yai.createdAt});
			this.socket.close();
		}
		this.socket = null;
		yai.fireEvent("disconnect" , yai);
	};

	this.connect = function () {
    var sessionId = this.getSessionId();
		if(!sessionId) return false;
		this.socket = new WebSocket('wss://hub.togetherjs.com/hub/youandi'+prefix+'_'+sessionId);

		this.socket.addEventListener('open', function (event) {
				 yai.fireEvent("connect" , event);
				 yai.send({"type" : "yai_hello" ,"createdAt" : yai.createdAt});
	   });

		this.socket.addEventListener('message', function (event) {
				 var data = JSON.parse(event.data);
				 if(data.type == "init-connection") {
					  yai.isLeader = data.peerCount == 0;
						yai.clusterState.leader =  yai.createdAt;
						yai.clusterState.nodes = [yai.createdAt];
						yai.fireEvent("clusterChange" , yai.clusterState);
				 } else if(data.type && data.type.startsWith("yai_")){
					 if(data.type == "yai_hello") {
						 yai.clusterState.nodes.push(data.createdAt);
						 if(yai.isLeader) {
						 		yai.send({"type" : "yai_clusterState" ,"state" : yai.clusterState});
								yai.fireEvent("onboard" , yai);
					   }
						 yai.fireEvent("clusterChange" , yai.clusterState);
					 } else if(data.type == "yai_bye") {
						 yai.clusterState.nodes = yai.arrayRemove(yai.clusterState.nodes, data.createdAt);
						 if(yai.clusterState.leader == data.createdAt){
							 yai.isLeader = yai.clusterState.nodes[0] == yai.createdAt;
							 if(yai.isLeader) yai.clusterState.leader = yai.createdAt;
						 }
						 if(yai.isLeader) {
						 		yai.send({"type" : "yai_clusterState" ,"state" : yai.clusterState});
						 }
						 yai.fireEvent("clusterChange" , yai.clusterState);
					 } else if(data.type == "yai_clusterState") {
						 yai.clusterState.leader =  data.state.leader;
						 yai.clusterState.nodes =  data.state.nodes;
						 yai.fireEvent("clusterChange" , yai.clusterState);
					 }  else if(data.type == "yai_cast") {
						 if(yai.isLeader){
							 data.type = "yai_message";
							 yai.send(data);
							 yai.fireEvent("message" , data.data);
						 }
					 } else if(data.type == "yai_message") {
						  yai.fireEvent("message" , data.data);
					 }
				 }
	   });

		 this.socket.addEventListener('close', function (event) {
 				 yai.disconnect();
 	   });
	};

}
