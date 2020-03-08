function YouAndI(prefix) {

	this.prefix = prefix;
	this.hubUrl = null;
	this.socket = null;
	this.yai = this;
	this.isLeader = true;
	this.copySelf = false;
	this.enforceSession = false;
	this.createdAt = new Date().getTime();
	this.clusterState = {leader : this.createdAt, nodes : [this.createdAt]};
	this.listeners = {
		clusterChange : [],
		onboard : [],
		bye : [],
		hello : [],
		connect : [],
		disconnect : [],
		message : [],
	}

	this.addListener = function (event, listener) {
		  this.listeners[event].push(listener.bind(this));
		  return this;
	};
	
	this.withHubUrl = function (hubUrl) {
		  this.hubUrl = hubUrl;
		  return this;
	};
	
	this.withCopySelf = function (copySelf) {
		  this.copySelf = copySelf;
		  return this;
	};
	
	this.withEnforceSession = function (enforceSession) {
		  this.enforceSession = enforceSession;
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

	this.uuid = function (sep) {
	  function s4() {
	    return Math.floor((1 + Math.random()) * 0x10000)
	      .toString(16)
	      .substring(1);
	  }
	  if(sep == null) sep = '-';
	  return s4() + s4() + sep + s4() + sep + s4() + sep + s4() + sep + s4() + s4() + s4();
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
	
	this.addNode = function (createdAt) {
		if(this.clusterState.nodes.indexOf(createdAt) < 0){							 
			 this.clusterState.nodes.push(createdAt);
		}
		this.checkLeader();
		if(this.isLeader) {
			this.send({"type" : "yai_clusterState" ,"state" : this.clusterState});
			this.fireEvent("onboard");
	    }
		this.fireEvent("clusterChange" , this.clusterState);
		this.fireEvent("hello" , createdAt);
	}
	
	this.removeNode = function (createdAt) {
		if(this.clusterState.nodes.indexOf(createdAt) >= 0){
			this.clusterState.nodes = this.arrayRemove(this.clusterState.nodes, createdAt);
			if(this.clusterState.leader == createdAt) this.clusterState.leader = this.createdAt;
			this.checkLeader();
			if(this.isLeader && this.createdAt != createdAt) {
			 	this.send({"type" : "yai_clusterState" ,"state" : this.clusterState});
		     }
			 this.fireEvent("clusterChange" , this.clusterState);
			 this.fireEvent("bye" , createdAt);
		}
	}

	this.checkLeader = function () {
		var i;
		for (i = 0; i < this.clusterState.nodes.length; i++) {
			this.clusterState.leader = Math.min(this.clusterState.leader, this.clusterState.nodes[i]);
		} 
		this.isLeader = this.clusterState.leader == this.createdAt;
	};
	
	this.send = function (message) {
		if(this.socket != null && this.socket.readyState == 1) {
			if(!message.type || !message.type.startsWith("yai_")) {
				if(this.isLeader) {
					this.fireEvent("message" , message);
					message = {"type" : "yai_message", "data" : message};
				} else {
					message = {"type" : "yai_cast", "data" : message};
				}
			}
			if(this.enforceSession) message.sessionId = this.getSessionId();
			message = JSON.stringify(message);
			this.socket.send(message)
			if(this.copySelf) this.onMessage({"data" : message});
		} else {
			console.warn("message not send", message);
			return false;
		}
	};
	
	this.disconnect = function () {
		if(this.socket != null) {
			this.send({"type" : "yai_bye" ,"createdAt" : this.createdAt});
			this.socket.close();
		}
		this.socket = null;
		this.fireEvent("disconnect");
		this.clusterState = {leader : this.createdAt, nodes : [this.createdAt]};
		this.isLeader = true;
		this.createdAt = new Date().getTime();
	};
	
	this.onMessage = function (event) {
	 var data = JSON.parse(event.data);
	 if(data.type && data.type.startsWith("yai_")){
		 if(yai.enforceSession && data.sessionId != yai.getSessionId()) return;
		 if(data.type == "yai_hello") {
			 yai.addNode(data.createdAt);
		 } else if(data.type == "yai_bye") {
			 yai.removeNode(data.createdAt);
		 } else if(data.type == "yai_clusterState") {
			 if(data.state.leader < yai.clusterState.leader){
				 yai.clusterState.leader =  data.state.leader;
				 yai.clusterState.nodes =  data.state.nodes;
				 yai.checkLeader();
				 yai.fireEvent("clusterChange" , yai.clusterState);
			 }
		 }  else if(data.type == "yai_cast" && yai.isLeader) {
			 data.type = "yai_message";
			 yai.send(data);
			 yai.fireEvent("message" , data.data);
		 } else if(data.type == "yai_message" && !yai.isLeader) {
			 yai.fireEvent("message" , data.data);
		 }
	 }
	};

	this.connect = function () {
		var sessionId = this.getSessionId();
		if(!sessionId) return false;
		if(!this.hubUrl){
            var hub = "wss://connect.websocket.in/v2/3977?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6Ijk0ODA5MmMxYTQxMzA1MmZkYTllNzU1MjQxMTdmMmJjYTcxODRjODYyMGZiZmEyYTQwODFmNTk2YzEzMTA2OWJkMzZmNTc2ZWE5NmY5NWE3In0.eyJhdWQiOiI4IiwianRpIjoiOTQ4MDkyYzFhNDEzMDUyZmRhOWU3NTUyNDExN2YyYmNhNzE4NGM4NjIwZmJmYTJhNDA4MWY1OTZjMTMxMDY5YmQzNmY1NzZlYTk2Zjk1YTciLCJpYXQiOjE1ODM1Njg5NTUsIm5iZiI6MTU4MzU2ODk1NSwiZXhwIjoxNjE1MTA0OTU1LCJzdWIiOiI2MjkiLCJzY29wZXMiOltdfQ.J5meB3VnqX1rLgbVbqZOLiaK7tY8LdZglcNAfFMk_xvyx9PDGy3vVpstFU17UrGwwjbR-fg_tfHvSk-hFb3yXKB3JxhK-LCHfh4cwiB8UbHgnz3ZgL_BEj0gm3JGg2Mb-0y1ckibt4JmBXabJTzUv0a75DG4cyh0okWjR3c937-YIBf70O5HBDeAm0HG2nD1z3p8qi0CLezxeK-gLz_xsUZ0Mno-_n3HkO4saYkrItCtt90Ug_v8qvw08Veij-hV6kxWb36JGgN0TLBLGI30NPdE-vXVF7RKYOBbdVB7z82ZLLo68SqYptA-ifDmEmCoOm1iIBpnLUIZgXI5kcQ26R-taGv5cq9BZxom-h5fSUszYz3qcQgAFC3wLPSNng5O37RMKZrtAPt6H9dRQeklBKZb7BnDIRsN_wQfx6RbXgIgimoO9TyzcWUdHpI3XHgdfh8OAvhyKzwV9Oul8uL_clr1A9N4vKJoQDVhlsNf_Bzq14v-1R9R1FQXxQb3vD3xyhMQHG9Owta195b4ilteEQxuiBly8qRwhGWreei2vPjVt5beaqtlhxde2AdoLP5GHKXRx8Xoz-P-VSYGu7OU-Kf4GOnh7XTT40L95CQNMHM4EmplgLKlaP_GyMNnWBL88HMbycLR4dNgS_7XSTS8RfWswK0LQX4BKb50VB16dcE"
        	this.withHubUrl(hub)
            .withCopySelf(true)
            .withEnforceSession(true)
		}
		this.socket = new WebSocket(this.hubUrl+prefix+'_'+sessionId);
		this.socket.addEventListener('open', function (event) {
			 yai.fireEvent("connect" , event);
			 yai.send({"type" : "yai_hello" ,"createdAt" : yai.createdAt});
	    });
	
		this.socket.addEventListener('message', this.onMessage);
		this.socket.addEventListener('close', function (event) {
			 yai.disconnect();
	    });
	};

}
