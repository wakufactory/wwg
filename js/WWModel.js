WWModel = function(){
	
}
WWModel.prototype.loadAjax = function(src) {
	return new Promise(function(resolve,reject) {
		var req = new XMLHttpRequest();
		req.open("get",src,true) ;
		req.responseType = "text" ;
		req.onload = function() {
			if(this.status==200) {
				resolve(this.response) ;
			} else {
				reject("Ajax error:"+this.statusText) ;					
			}
		}
		req.onerror = function() {
			reject("Ajax error:"+this.statusText)
		}
		req.send() ;
	})
}
WWModel.prototype.loadObj = function(path,scale) {
	var self = this ;
	if(!scale) scale=1.0 ;
	return new Promise(function(resolve,reject) {
		self.loadAjax(path).then(function(data) {
//			console.log(data) ;
			var l = data.split("\n") ;
			var v = [];
			var n = [] ;
			var x = [] ;
			var t = [] ;
			var xi = {} ;
			var xic = 0 ;

			for(var i = 0;i<l.length;i++) {
				if(l[i].match(/^#/)) continue ;
				if(l[i].match(/^eof/)) break ;
				var ll = l[i].split(/\s+/) ;
				if(ll[0] == "v") {
					v.push([ll[1]*scale,ll[2]*scale,ll[3]*scale]) ;
				}
				if(ll[0] == "vt") {
					t.push([ll[1],ll[2]]) ;
				}
				if(ll[0] == "vn") {
					n.push([ll[1],ll[2],ll[3]]) ;
				}
				if(ll[0] == "f") {
					var ix = [] ;
					for(var ii=1;ii<ll.length;ii++) {
						if(ll[ii]=="") continue ;
						if(!(ll[ii] in xi)) xi[ll[ii]] = xic++ ; 
						ix.push(xi[ll[ii]]) ;
					}
					x.push(ix) ;
				}
			}
			self.obj_v = [] ;
			self.obj_i =x ;
			if(n.length>0) self.obj_n = [] ;
			if(t.length>0) self.obj_t = [] ;
			for(var i in xi) {
				var si = i.split("/") ;
				var ind = xi[i] ;
				self.obj_v[ind] = v[si[0]-1] ;
				if(t.length>0) self.obj_t[ind] = t[si[1]-1] ;
				if(n.length>0) self.obj_n[ind] = n[si[2]-1] ;
			}
			console.log("loadobj "+path+" vtx:"+v.length+" norm:"+n.length+" tex:"+t.length+" idx:"+x.length+" vbuf:"+self.obj_v.length) ;
			resolve(self) ;
		}).catch(function(err) {
			reject(err) ;
		})
	}) ;
}
WWModel.prototype.objNorm  = function() {
	var v = this.obj_v ;
	var s = this.obj_i ;
	var n = this.obj_n ;
	var t = this.obj_t ;

	var vbuf = [] ;
	var ibuf = [] ;
	var sf = [] ;
	var sn = [] ;
	var ii = 0 ;
	if(!n) this.obj_n = [] ;

	for(var i=0;i<s.length;i++) {
		var p = s[i] ;
		if(!n) {
			//面法線算出
			var pa = [] ;
			for(var j=0;j<3;j++) {
				pa[j] = v[p[j]] ;
			}
			var yx = pa[1][0]-pa[0][0];
			var yy = pa[1][1]-pa[0][1];
			var yz = pa[1][2]-pa[0][2];
			var zx = pa[2][0]-pa[0][0];
			var zy = pa[2][1]-pa[0][1];
			var zz = pa[2][2]-pa[0][2];				
			var xx =  yy * zz - yz * zy;
			var xy = -yx * zz + yz * zx;
			var xz =  yx * zy - yy * zx;
			var vn = Math.sqrt(xx*xx+xy*xy+xz*xz) ;
			xx /= vn ; xy /= vn ; xz /= vn ;
			sf.push( [xx,xy,xz]) ;
			//面リスト
			for(var j=0;j<p.length;j++) {
				if(!sn[p[j]]) sn[p[j]] = [] ;
				sn[p[j]].push(i) ;
			}
		}
		//3角分割
		for(var j=1;j<p.length-1;j++) {
			ibuf.push(p[0]) ;
			ibuf.push(p[j]) ;
			ibuf.push(p[j+1] ) ;
		}
		ii += p.length ;
	}
	console.log(" poly:"+ibuf.length/3);
	for(var i=0;i<v.length;i++) {
		vbuf.push( v[i][0] ) ;
		vbuf.push( v[i][1] ) ;
		vbuf.push( v[i][2] ) ;
		var nx=0,ny=0,nz=0 ;		
		if(n) {
			nx = n[i][0] ;
			ny = n[i][1] ;
			nz = n[i][2] ;
		} else {
			//面法線の合成
			for(var j=0;j<sn[i].length;j++) {
				var ii = sn[i][j] ;
				nx += sf[ii][0] ;
				ny += sf[ii][1] ;
				nz += sf[ii][2] ;
			}
		}
		var vn = Math.sqrt(nx*nx+ny*ny+nz*nz) ;
		vbuf.push(nx/vn) ;
		vbuf.push(ny/vn) ;
		vbuf.push(nz/vn) ;
		if(!n) {
			this.obj_n.push([nx/vn,ny/vn,nz/vn]); 
		}
		
		if(t) {
			vbuf.push(t[i][0]) ;
			vbuf.push(t[i][1]) ;
		}
	}
//	console.log(vbuf) ;
//	console.log(ibuf) ;
	this.ibuf = ibuf ;
	this.vbuf = vbuf ;
	var ret = {mode:"tri",vtx_at:["position","norm"],vtx:vbuf,idx:ibuf} ;
	if(t) ret.vtx_at.push("uv") ;
	return ret ;
}
// generate normal vector lines
WWModel.prototype.normLines = function() {
	var nv = [] ;
	var v = this.obj_v
	var n = this.obj_n ;
	var vm = 0.1
	for(var i=0;i<v.length;i++) {
		nv.push(v[i][0]) ;
		nv.push(v[i][1]) ;
		nv.push(v[i][2]) ;
		nv.push(v[i][0]+n[i][0]*vm) ;
		nv.push(v[i][1]+n[i][1]*vm) ;
		nv.push(v[i][2]+n[i][2]*vm) ;
	}
	return  {mode:"lines",vtx_at:["position"],vtx:nv,fs_uni:{
		color:[0.5,0.5,1.0,0.5],mode:1}} ;
}
WWModel.prototype.primitive  = function(type,p) {
	if(!p) p = {} ;
	var wx = (p.wx)?p.wx:1.0 ;
	var wy = (p.wy)?p.wy:1.0 ;
	var wz = (p.wz)?p.wz:1.0 ;
	var div = (p.div)?p.div:10 ;
	var p = [] ;
	var n = [] ;
	var t = [] ;
	var s = [] ;
	var PHI = Math.PI *2 ;
	switch(type) {
	case "sphere":
		for(var i = 0 ; i <= div ; ++i) {
			var v = i / (0.0+div);
			var y = Math.cos(Math.PI * v), r = Math.sin(Math.PI * v);
			for(var j = 0 ; j <= div*2 ; ++j) {
				var u = j / (0.0+div*2) ;
				var x = (Math.cos(PHI * u) * r)
				var z = (Math.sin(PHI * u) * r)
				p.push([x*wx,y*wy,z*wz])
				n.push([x,y,z])
				t.push([1-u,1-v])
			}
		}
		var d2 = div*2+1 ;
		for(var j = 0 ; j < div ; ++j) {
			var base = j * d2;
			for(var i = 0 ; i < div*2 ; ++i) {
				s.push(
				[base + i,	  base + i + 1, base + i     + d2],
				[base + i + d2, base + i + 1, base + i + 1 + d2]);
			}
		}
		break;
	case "box":
		p = [
			[wx,wy,wz],[wx,-wy,wz],[-wx,-wy,wz],[-wx,wy,wz],
			[wx,wy,-wz],[wx,-wy,-wz],[-wx,-wy,-wz],[-wx,wy,-wz],
			[wx,wy,wz],[wx,-wy,wz],[wx,-wy,-wz],[wx,wy,-wz],
			[-wx,wy,wz],[-wx,-wy,wz],[-wx,-wy,-wz],[-wx,wy,-wz],
			[wx,wy,wz],[wx,wy,-wz],[-wx,wy,-wz],[-wx,wy,wz],
			[wx,-wy,wz],[wx,-wy,-wz],[-wx,-wy,-wz],[-wx,-wy,wz],
		]
		n = [
			[0,0,1],[0,0,1],[0,0,1],[0,0,1],
			[0,0,-1],[0,0,-1],[0,0,-1],[0,0,-1],
			[1,0,0],[1,0,0],[1,0,0],[1,0,0],
			[-1,0,0],[-1,0,0],[-1,0,0],[-1,0,0],
			[0,1,0],[0,1,0],[0,1,0],[0,1,0],
			[0,-1,0],[0,-1,0],[0,-1,0],[0,-1,0]
		]
		t = [
			[1,1],[1,0],[0,0],[0,1],
			[0,1],[0,0],[1,0],[1,1],
			[0,1],[0,0],[1,0],[1,1],
			[1,1],[1,0],[0,0],[0,1],
			[1,0],[1,1],[0,1],[0,0],
			[1,1],[1,0],[0,0],[0,1]
		]
		s = [
			[3,1,0],[2,1,3],
			[4,5,7],[7,5,6],
			[8,9,11],[11,9,10],
			[15,13,12],[14,13,15],	
			[16,17,19],[19,17,18],
			[23,21,20],[22,21,23],		
		]
		break ;
	}
	this.obj_v = p 
	this.obj_n = n
	this.obj_t = t
	this.obj_i = s
	console.log(p)
	console.log(n)
	console.log(t)
	console.log(s)
}
