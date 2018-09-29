//mouse and touch event handler
Pointer = function(t,cb) {
	var self = this ;
	var touch,gesture,EV_S,EV_E,EV_M ;
	function pos(ev) {
		var x,y ;
		if(touch && ev.touches.length>0) {
			x = ev.touches[0].pageX - ev.target.offsetLeft ;
			y = ev.touches[0].pageY - ev.target.offsetTop ;
		} else {
			x = ev.offsetX ;
			y = ev.offsetY ;
		}
		return {x:x,y:y} ;
	}
	t.addEventListener("mousedown", startev,false ) ;
	t.addEventListener("touchstart", startev,false ) ;
	function startev(ev) {
		if(gesture) return ;
		if(!EV_S) {
			touch = (ev.type=="touchstart") ;
			setevent() ;
			first = false ;
		}
		self.mf = true ;
		self.dx = self.dy = 0 ;
		self.s = pos(ev) ;
		self.lastd = self.s ;
		if(cb.down) if(!cb.down({x:self.s.x,y:self.s.y,sx:self.s.x,sy:self.s.y})) ev.preventDefault() ;	
	}
	function setevent() {
		if(touch) {
			EV_S = "touchstart" ;
			EV_E = "touchend" ;
			EV_O = "touchcancel" ;
			EV_M = "touchmove" ;
		} else {
			EV_S = "mousedown" ;
			EV_E = "mouseup" ;
			EV_O = "mouseout" ;
			EV_M = "mousemove" ;	
		}
		t.addEventListener(EV_E, function(ev) {
			var c = pos(ev) ;
			var d = (ev.type=="touchend")?self.lastd:pos(ev) ;
			self.mf = false ;
			if(cb.up) if(!cb.up({x:c.x,y:c.y,ex:d.x,ey:d.y,dx:self.dx,dy:self.dy})) ev.preventDefault() ;
		},false);
		t.addEventListener(EV_O, function(ev) {
			self.mf = false ;
			var c = pos(ev) ;
			if(cb.out) if(!cb.out({x:c.x,y:c.y,dx:self.dx,dy:self.dy})) ev.preventDefault() ;
		},false);
		t.addEventListener(EV_M, function(ev) {
			if(gesture) return ;
			var d = pos(ev) ;
			self.lastd = d ;
			if(self.mf) {
				self.dx = (d.x-self.s.x) ;
				self.dy = (d.y-self.s.y) ;
				if(cb.move) if(!cb.move({x:d.x,y:d.y,ox:d.x,oy:d.y,dx:self.dx,dy:self.dy})) ev.preventDefault() ;
			}
		},false)	
	}
	if(cb.contextmenu) {
		t.addEventListener("contextmenu", function(ev){
			if(!cb.contextmenu({px:ev.offsetX,py:ev.offsetY})) ev.preventDefault() ;
		},false )
	}
	if(cb.wheel) {
		t.addEventListener("wheel", function(ev){
			if(!cb.wheel(ev.deltaY)) ev.preventDefault() ;
		},false ) ;
	}
	if(cb.gesture) {
		t.addEventListener("gesturestart", function(ev){
			gesture = true ;
			if(!cb.gesture(0,0)) ev.preventDefault() ;
		})
		t.addEventListener("gesturechange", function(ev){
		
			if(!cb.gesture(ev.scale,ev.rotation)) ev.preventDefault() ;
		})
		t.addEventListener("gestureend", function(ev){
			gesture = false ;
		})
	}
	if(cb.gyro) {
		window.addEventListener("deviceorientation", function(ev) {
			var or = window.orientation ;
			var rx,ry,rz ;
			rx = null ;ry = null; rz = null ;
			switch( or ){
				case 90:
					if(ev.gamma<0) {
						rx = ev.gamma+90 ;
						ry = 180-ev.alpha ;
						rz = ev.beta+180 ;						
					} else {
						rx = ev.gamma-90 ;
						ry = 360-ev.alpha ;
						rz = ev.beta ;						
					}
					break ;
				case -90:
					if(ev.gamma<0) {
						rx = -ev.gamma-90 ;
						ry = 180-ev.alpha ;
						rz = -ev.beta+180 ;	
					} else {
						rx = -ev.gamma+90 ;
						ry = 360-ev.alpha ;
						rz = -ev.beta ;						
					}

					break ;	
				default:
		
			}

			cb.gyro({rx:rx,ry:ry,rz:rz,orientation:or}) ;
		})
	}
}
