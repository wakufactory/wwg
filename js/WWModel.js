//Model library for WWG
// Version 0.9 
// 2016-2017 wakufactory.jp 
// license: MIT 

var WWModel = function(){
	
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
// load .obj file
WWModel.prototype.loadObj = async function(path,scale) {
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
//convert vtx data to vbo array
WWModel.prototype.objModel  = function(addvec,mode) {
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
	console.log(" vert:"+v.length);
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
		if(addvec) {
			for(av=0;av<addvec.length;av++) {
				vbuf = vbuf.concat(addvec[av].data[i]) ;
			}
		}
	}

//	console.log(vbuf) ;
//	console.log(ibuf) ;
	this.ibuf = ibuf ;
	this.vbuf = vbuf ;
	var ret = {mode:"tri",vtx_at:["position","norm"],vtx:vbuf,idx:ibuf} ;
	if(t) ret.vtx_at.push("uv") ;
	if(addvec) {
		for(av=0;av<addvec.length;av++) ret.vtx_at.push(addvec[av].attr) ;
	}
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
	return  {mode:"lines",vtx_at:["position"],vtx:nv} ;
}
// generate wireframe lines
WWModel.prototype.wireframe = function() {
	var nv = [] ;
	var v = this.obj_v ;
	var s = this.obj_i ;
	for(var k=0;k<s.length;k++) {
		var ss = s[k]; 
		for(var i=1;i<ss.length;i++) {
			nv.push(v[ss[i-1]][0]) ;
			nv.push(v[ss[i-1]][1]) ;
			nv.push(v[ss[i-1]][2]) ;
			nv.push(v[ss[i]][0]) ;
			nv.push(v[ss[i]][1]) ;
			nv.push(v[ss[i]][2]) ;
		}
		nv.push(v[ss[i-1]][0]) ;
		nv.push(v[ss[i-1]][1]) ;
		nv.push(v[ss[i-1]][2]) ;		
		nv.push(v[ss[0]][0]) ;
		nv.push(v[ss[0]][1]) ;
		nv.push(v[ss[0]][2]) ;	
	}
	return  {mode:"lines",vtx_at:["position"],vtx:nv} ;	
}

// mult 4x4 matrix
WWModel.prototype.multMatrix4 = function(m4) {
	var inv = new CanvasMatrix4(m4).invert().transpose() ;
	var buf = m4.getAsArray()
	for(var i=0;i<this.obj_v.length;i++) {
		var v = this.obj_v[i] ;
		var vx = buf[0] * v[0] + buf[4] * v[1] + buf[8] * v[2] + buf[12] ;
		var vy = buf[1] * v[0] + buf[5] * v[1] + buf[9] * v[2] + buf[13] ;
		var vz = buf[2] * v[0] + buf[6] * v[1] + buf[10] * v[2] + buf[14] ;
		this.obj_v[i] = [vx,vy,vz] ;
	}
}
WWModel.prototype.mergeModels = function(models) {
	var m = this ;
	var ofs = 0 ;
	for(var i=0;i<models.length;i++) {
		m.obj_v = m.obj_v.concat(models[i].obj_v) 
		m.obj_n = m.obj_n.concat(models[i].obj_n) 
		m.obj_t = m.obj_t.concat(models[i].obj_t)
		for(var j=0;j<models[i].obj_i.length;j++) {
			var p = models[i].obj_i[j] ;
			var pp = [] ;
			for( n=0;n<p.length;n++) {
				pp.push( p[n]+ofs ) ;
			}
			m.obj_i.push(pp) ;
		}
		ofs += models[i].obj_v.length ;
	}
	return m ;
}
// generate primitive
WWModel.prototype.primitive  = function(type,param) {
	if(!param) param = {} ;
	var wx = (param.wx)?param.wx:1.0 ;
	var wy = (param.wy)?param.wy:1.0 ;
	var wz = (param.wz)?param.wz:1.0 ;
	var div = (param.div)?param.div:10 ;
	var ninv = (param.ninv)?-1:1 ;
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
				n.push([x*ninv,y*ninv,z*ninv])
				t.push([1-u,1-v])
			}
		}
		var d2 = div*2+1 ;
		for(var j = 0 ; j < div ; ++j) {
			var base = j * d2;
			for(var i = 0 ; i < div*2 ; ++i) {
				if(ninv>0) s.push(
					[base + i,	  base + i + 1, base + i     + d2],
					[base + i + d2, base + i + 1, base + i + 1 + d2]);
				else s.push(
					[base + i     + d2,	base + i + 1, base + i],
					[base + i + 1 + d2, base + i + 1, base + i + d2 ]);

			}
		}
		break;
	case "cylinder":
		for(var i = 0 ; i <= div ; ++i) {
			var v = i / (0.0+div);
			var z = Math.sin(PHI * v)*wz, x = Math.cos(PHI * v)*wx;
			p.push([x,wy,z])
			n.push([x*ninv,0,z*ninv])
			t.push([1-v,1])
			p.push([x,-wy,z])
			n.push([x*ninv,0,z*ninv,0])
			t.push([1-v,0])			
		}
		for(var j =0; j < div ;j++) {
			if(ninv<0)s.push([j*2,j*2+2,j*2+3,j*2+1]) ;
			else s.push([j*2,j*2+1,j*2+3,j*2+2]) ;
		}
		break; 
	case "cone":
		for(var i = 0 ; i <= div ; ++i) {
			var v = i / (0.0+div);
			var z = Math.cos(PHI * v)*wz, x = Math.sin(PHI * v)*wx;
			p.push([0,wy,0])
			n.push([x*ninv,0,z*ninv])
			t.push([v,1])
			p.push([x,-wy,z])
			n.push([x*ninv,0,z*ninv,0])
			t.push([v,0])			
		}
		for(var j =0; j < div ;j++) {
			if(ninv<0)s.push([j*2,j*2+2,j*2+3,j*2+1]) ;
			else s.push([j*2,j*2+1,j*2+3,j*2+2]) ;
		}
		break; 
	case "disc":
		for(var i = 0 ; i < div ; ++i) {
			var v = i / (0.0+div);
			var z = Math.cos(PHI * v)*wz, x = Math.sin(PHI * v)*wx;
			p.push([x,0,z])
			n.push([0,1,0])
			t.push([(x/wx+1)/2,(z/wz+1)/2])	
		}
		p.push([0,0,0])
		n.push([0,1,0])
		t.push([0.5,0.5])
		for(var j =0; j < div-1 ;j++) {
			s.push([j,j+1,div]) ;
		}
		s.push([j,0,div])
		break; 
	case "plane":
		p = [[wx,0,wz],[wx,0,-wz],[-wx,0,-wz],[-wx,0,wz]]
		n = [[0,1,0],[0,1,0],[0,1,0],[0,1,0]]
		t = [[1,0],[1,1],[0,1],[0,0]]
		s = [[0,1,2],[2,3,0]]
		break ;
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
			[0,0,ninv],[0,0,ninv],[0,0,ninv],[0,0,ninv],
			[0,0,-ninv],[0,0,-ninv],[0,0,-ninv],[0,0,-ninv],
			[ninv,0,0],[ninv,0,0],[ninv,0,0],[ninv,0,0],
			[-ninv,0,0],[-ninv,0,0],[-ninv,0,0],[-ninv,0,0],
			[0,ninv,0],[0,ninv,0],[0,ninv,0],[0,ninv,0],
			[0,-ninv,0],[0,-ninv,0],[0,-ninv,0],[0,-ninv,0]
		]
		t = [
			[1,1],[1,0],[0,0],[0,1],
			[0,1],[0,0],[1,0],[1,1],
			[0,1],[0,0],[1,0],[1,1],
			[1,1],[1,0],[0,0],[0,1],
			[1,0],[1,1],[0,1],[0,0],
			[1,1],[1,0],[0,0],[0,1]
		]
		s = (ninv>0)?[
			[3,1,0],[2,1,3],
			[4,5,7],[7,5,6],
			[8,9,11],[11,9,10],
			[15,13,12],[14,13,15],	
			[16,17,19],[19,17,18],
			[23,21,20],[22,21,23],		
		]:[
			[0,1,3],[3,1,2],
			[7,5,4],[6,5,7],
			[11,9,8],[10,9,11],
			[12,13,15],[15,13,14],	
			[19,17,16],[18,17,19],
			[20,21,23],[23,21,22],		
		]
		break ;
	case "mesh":
		this.parametricModel( function(u,v) {
			var r = {
				px:(u-0.5)*wx, py:0, pz:(v-0.5)*wz,
				nx:0, ny:1, nz:0,
				mu:u, mv:v }
			return r ;
		},{start:1.0,end:0,div:div},{start:0,end:1,div:div},{ninv:param.ninv}) ;
		return this ;		
		break ;
	case "torus":
		this.parametricModel( function(u,v) {
			var R = 1.0 ;
			var sr = (param.sr)?param.sr:0.5 ;
			var du = u ;
			var dv = -v ;
			var cx = Math.sin(du*PHI) ;
			var cz = Math.cos(du*PHI) ;
			var vx = Math.sin(dv*PHI) ;
			var vy = Math.cos(dv*PHI) ;
			var tx = 1
			var mx = sr*vx*cx ;
			var mz = sr*vx*cz ;
			var my = sr*vy ;
			var ml = Math.sqrt(mx*mx+my*my+mz*mz) ;
	
			var px = R*cx + tx*mx ;
			var pz = R*cz + tx*mz ;
			var py = tx*my ;
			var r = {
				px:px*wx, py:py*wy, pz:pz*wz,
				nx:0, ny:0, nz:0,
				mu:u, mv:v }
			return r ;			
			
		},{start:0,end:1.0,div:div*2},{start:0,end:1,div:div},{ninv:param.ninv}) ;
		return this ;
	case "polyhedron":
		var m = { "r05":{"v":[[-0.52573111,-0.7236068,0.4472136],[-0.85065081,0.2763932,0.4472136],[-0,0.89442719,0.4472136],[0.85065081,0.2763932,0.4472136],[0.52573111,-0.7236068,0.4472136],[0,-0.89442719,-0.4472136],[-0.85065081,-0.2763932,-0.4472136],[-0.52573111,0.7236068,-0.4472136],[0.52573111,0.7236068,-0.4472136],[0.85065081,-0.2763932,-0.4472136],[0,0,1],[-0,0,-1]],"s":[[0,1,6],[0,6,5],[0,5,4],[0,4,10],[0,10,1],[1,2,7],[1,7,6],[1,10,2],[2,3,8],[2,8,7],[2,10,3],[3,4,9],[3,9,8],[3,10,4],[4,5,9],[5,6,11],[5,11,9],[6,7,11],[7,8,11],[8,9,11]]},
		"r04":{"v":[[-0.35682209,-0.49112347,0.79465447],[0.35682209,-0.49112347,0.79465447],[0.57735027,-0.79465447,0.18759247],[0,-0.98224695,-0.18759247],[-0.57735027,-0.79465447,0.18759247],[-0.57735027,0.18759247,0.79465447],[0.57735027,0.18759247,0.79465447],[0.93417236,-0.303531,-0.18759247],[-0,-0.607062,-0.79465447],[-0.93417236,-0.303531,-0.18759247],[-0.93417236,0.303531,0.18759247],[0,0.607062,0.79465447],[0.93417236,0.303531,0.18759247],[0.57735027,-0.18759247,-0.79465447],[-0.57735027,-0.18759247,-0.79465447],[-0.57735027,0.79465447,-0.18759247],[0,0.98224695,0.18759247],[0.57735027,0.79465447,-0.18759247],[0.35682209,0.49112347,-0.79465447],[-0.35682209,0.49112347,-0.79465447]],"s":[[0,1,6,11,5],[0,5,10,9,4],[0,4,3,2,1],[1,2,7,12,6],[2,3,8,13,7],[3,4,9,14,8],[5,11,16,15,10],[6,12,17,16,11],[7,13,18,17,12],[8,14,19,18,13],[9,10,15,19,14],[15,16,17,18,19]]},
		"r03":{"v":[[-0.57735027,-0.57735027,0.57735027],[-0.57735027,0.57735027,0.57735027],[0.57735027,0.57735027,0.57735027],[0.57735027,-0.57735027,0.57735027],[-0.57735027,-0.57735027,-0.57735027],[-0.57735027,0.57735027,-0.57735027],[0.57735027,0.57735027,-0.57735027],[0.57735027,-0.57735027,-0.57735027]],"s":[[0,1,5,4],[0,4,7,3],[0,3,2,1],[1,2,6,5],[2,3,7,6],[4,5,6,7]]},
		"r02":{"v":[[-0.70710678,-0.70710678,0],[-0.70710678,0.70710678,0],[0.70710678,0.70710678,0],[0.70710678,-0.70710678,0],[0,0,-1],[0,0,1]],"s":[[0,1,4],[0,4,3],[0,3,5],[0,5,1],[1,2,4],[1,5,2],[2,3,4],[2,5,3]]},
		"r01":{"v":[[-0.81649658,-0.47140452,0.33333333],[0.81649658,-0.47140452,0.33333333],[0,0,-1],[0,0.94280904,0.33333333]],"s":[[0,1,3],[0,3,2],[0,2,1],[1,2,3]]},
		"s11":{"v":[[-0.13149606,-0.40470333,0.90494412],[-0.34426119,-0.25012042,0.90494412],[-0.42553024,-1.0e-8,0.90494412],[-0.34426119,0.2501204,0.90494412],[-0.13149606,0.40470332,0.90494412],[0.13149611,0.40470332,0.90494412],[0.34426124,0.2501204,0.90494412],[0.42553028,-1.0e-8,0.90494412],[0.34426124,-0.25012042,0.90494412],[0.13149611,-0.40470333,0.90494412],[-0.13149606,-0.62841783,0.76668096],[-0.34426119,-0.69754941,0.6284178],[-0.42553024,-0.80940666,0.4047033],[-0.34426119,-0.92126391,0.18098881],[-0.13149606,-0.99039549,0.04272564],[0.13149611,-0.99039549,0.04272564],[0.34426124,-0.92126391,0.18098881],[0.42553028,-0.80940666,0.4047033],[0.34426124,-0.69754941,0.6284178],[0.13149611,-0.62841783,0.76668096],[-0.55702632,-0.5429665,0.6284178],[-0.55702632,-0.319252,0.76668096],[-0.63829537,-0.06913159,0.76668096],[-0.76979145,0.11185724,0.6284178],[-0.90128753,0.15458291,0.4047033],[-0.98255658,0.04272566,0.1809888],[-0.98255658,-0.18098884,0.04272564],[-0.90128753,-0.43110925,0.04272564],[-0.76979145,-0.61209808,0.18098881],[-0.63829537,-0.65482375,0.4047033],[-0.82001848,0.54296648,0.18098881],[-0.82001848,0.40470332,0.4047033],[-0.6885224,0.36197765,0.6284178],[-0.47575727,0.43110923,0.76668096],[-0.26299214,0.58569215,0.76668096],[-0.13149606,0.76668098,0.6284178],[-0.13149606,0.90494414,0.4047033],[-0.26299214,0.94766981,0.18098881],[-0.47575727,0.87853823,0.04272564],[-0.6885224,0.72395531,0.04272564],[0.47575732,0.87853821,0.04272564],[0.26299219,0.94766979,0.1809888],[0.13149611,0.90494413,0.4047033],[0.13149611,0.76668098,0.6284178],[0.26299219,0.58569215,0.76668096],[0.47575732,0.43110923,0.76668096],[0.68852245,0.36197765,0.6284178],[0.82001853,0.4047033,0.40470331],[0.82001853,0.54296646,0.18098881],[0.68852245,0.72395529,0.04272564],[0.63829541,-0.65482375,0.4047033],[0.7697915,-0.61209808,0.18098881],[0.90128758,-0.43110925,0.04272564],[0.98255663,-0.18098884,0.04272564],[0.98255647,0.04272561,0.18098879],[0.9012875,0.15458288,0.40470331],[0.7697915,0.11185724,0.6284178],[0.63829541,-0.06913159,0.76668096],[0.55702637,-0.319252,0.76668096],[0.55702637,-0.5429665,0.6284178],[-0.47575727,-0.87853824,-0.04272569],[-0.6885224,-0.72395533,-0.04272569],[-0.82001848,-0.5429665,-0.18098886],[-0.82001848,-0.40470333,-0.40470335],[-0.6885224,-0.36197767,-0.62841785],[-0.47575727,-0.43110925,-0.76668101],[-0.26299214,-0.58569216,-0.76668101],[-0.13149605,-0.76668099,-0.62841784],[-0.13149606,-0.90494416,-0.40470335],[-0.26299214,-0.94766982,-0.18098885],[-0.90128753,-0.15458292,-0.40470335],[-0.98255658,-0.04272567,-0.18098885],[-0.98255658,0.18098882,-0.04272569],[-0.90128753,0.43110923,-0.04272569],[-0.76979145,0.61209806,-0.18098885],[-0.63829536,0.65482373,-0.40470335],[-0.55702632,0.54296648,-0.62841785],[-0.55702632,0.31925199,-0.76668101],[-0.63829537,0.06913157,-0.76668101],[-0.76979145,-0.11185726,-0.62841785],[-0.13149606,0.62841781,-0.76668101],[-0.34426119,0.6975494,-0.62841785],[-0.42553023,0.80940665,-0.40470335],[-0.34426119,0.92126389,-0.18098885],[-0.13149606,0.99039547,-0.04272569],[0.13149611,0.99039546,-0.04272569],[0.34426124,0.92126387,-0.18098886],[0.42553028,0.80940661,-0.40470335],[0.34426124,0.69754939,-0.62841785],[0.13149611,0.62841781,-0.76668101],[0.76979153,-0.11185725,-0.62841782],[0.63829541,0.06913155,-0.76668097],[0.55702634,0.31925197,-0.76668097],[0.55702635,0.54296649,-0.62841782],[0.63829541,0.6548237,-0.40470335],[0.76979149,0.61209803,-0.18098885],[0.9012875,0.43110919,-0.04272571],[0.98255648,0.18098877,-0.04272572],[0.9825564,-0.04272561,-0.18098874],[0.90128711,-0.15458281,-0.4047032],[0.26299219,-0.94766982,-0.18098885],[0.13149611,-0.90494416,-0.40470335],[0.13149611,-0.76668098,-0.62841784],[0.26299219,-0.58569215,-0.76668099],[0.47575682,-0.43110886,-0.76668009],[0.68852237,-0.36197738,-0.6284173],[0.82001805,-0.40470325,-0.40470322],[0.82001853,-0.5429665,-0.18098885],[0.68852245,-0.72395533,-0.04272569],[0.47575732,-0.87853824,-0.04272569],[-0.13149606,-0.40470333,-0.90494417],[-0.34426119,-0.25012042,-0.90494417],[-0.42553024,-0,-0.90494417],[-0.34426119,0.2501204,-0.90494417],[-0.13149606,0.40470332,-0.90494417],[0.13149611,0.40470332,-0.90494417],[0.3442612,0.25012038,-0.90494414],[0.42553027,-3.0e-8,-0.90494414],[0.3442606,-0.25012001,-0.90494332],[0.13149611,-0.40470332,-0.90494416]],"s":[[0,1,21,20,11,10],[0,10,19,9],[0,9,8,7,6,5,4,3,2,1],[1,2,22,21],[2,3,33,32,23,22],[3,4,34,33],[4,5,44,43,35,34],[5,6,45,44],[6,7,57,56,46,45],[7,8,58,57],[8,9,19,18,59,58],[10,11,12,13,14,15,16,17,18,19],[11,20,29,12],[12,29,28,61,60,13],[13,60,69,14],[14,69,68,101,100,15],[15,100,109,16],[16,109,108,51,50,17],[17,50,59,18],[20,21,22,23,24,25,26,27,28,29],[23,32,31,24],[24,31,30,73,72,25],[25,72,71,26],[26,71,70,63,62,27],[27,62,61,28],[30,31,32,33,34,35,36,37,38,39],[30,39,74,73],[35,43,42,36],[36,42,41,85,84,37],[37,84,83,38],[38,83,82,75,74,39],[40,41,42,43,44,45,46,47,48,49],[40,49,95,94,87,86],[40,86,85,41],[46,56,55,47],[47,55,54,97,96,48],[48,96,95,49],[50,51,52,53,54,55,56,57,58,59],[51,108,107,52],[52,107,106,99,98,53],[53,98,97,54],[60,61,62,63,64,65,66,67,68,69],[63,70,79,64],[64,79,78,112,111,65],[65,111,110,66],[66,110,119,103,102,67],[67,102,101,68],[70,71,72,73,74,75,76,77,78,79],[75,82,81,76],[76,81,80,114,113,77],[77,113,112,78],[80,81,82,83,84,85,86,87,88,89],[80,89,115,114],[87,94,93,88],[88,93,92,116,115,89],[90,91,92,93,94,95,96,97,98,99],[90,99,106,105],[90,105,104,118,117,91],[91,117,116,92],[100,101,102,103,104,105,106,107,108,109],[103,119,118,104],[110,111,112,113,114,115,116,117,118,119]]},
		"s06":{"v":[[-0.20177411,-0.27771823,0.93923362],[-0.40354821,-0.55543646,0.72707577],[-0.20177411,-0.8331547,0.51491792],[0.20177411,-0.8331547,0.51491792],[0.40354821,-0.55543646,0.72707577],[0.20177411,-0.27771823,0.93923362],[-0.32647736,0.10607893,0.93923362],[-0.65295472,0.21215785,0.72707577],[-0.85472883,-0.06556038,0.51491792],[-0.73002557,-0.44935754,0.51491792],[-0.73002557,-0.66151539,0.17163931],[-0.40354821,-0.89871508,0.17163931],[-0.20177411,-0.96427546,-0.17163931],[0.20177411,-0.96427546,-0.17163931],[0.40354821,-0.89871508,0.17163931],[0.73002557,-0.66151539,0.17163931],[0.73002557,-0.44935754,0.51491792],[0.85472883,-0.06556038,0.51491792],[0.65295472,0.21215785,0.72707577],[0.32647736,0.10607893,0.93923362],[-0,0.34327861,0.93923362],[-0.65295472,0.55543646,0.51491792],[-0.85472883,0.48987608,0.17163931],[-0.97943209,0.10607893,0.17163931],[-0.97943209,-0.10607892,-0.17163931],[-0.85472883,-0.48987608,-0.17163931],[-0.65295472,-0.55543646,-0.51491792],[-0.32647736,-0.79263615,-0.51491792],[-0,-0.68655723,-0.72707577],[0.32647736,-0.79263615,-0.51491792],[0.65295472,-0.55543646,-0.51491792],[0.85472883,-0.48987608,-0.17163931],[0.97943209,-0.10607893,-0.17163931],[0.97943209,0.10607893,0.17163931],[0.85472883,0.48987608,0.17163931],[0.65295472,0.55543646,0.51491792],[0.32647736,0.79263615,0.51491792],[0,0.68655723,0.72707577],[-0.32647736,0.79263615,0.51491792],[-0.73002557,0.66151539,-0.17163931],[-0.73002557,0.44935754,-0.51491792],[-0.85472883,0.06556038,-0.51491792],[-0.65295472,-0.21215785,-0.72707577],[-0.32647736,-0.10607892,-0.93923362],[0,-0.34327861,-0.93923362],[0.32647736,-0.10607892,-0.93923362],[0.65295472,-0.21215785,-0.72707577],[0.85472883,0.06556038,-0.51491792],[0.73002557,0.44935754,-0.51491792],[0.73002557,0.66151539,-0.17163931],[0.40354821,0.89871508,-0.17163931],[0.20177411,0.96427546,0.17163931],[-0.20177411,0.96427546,0.17163931],[-0.40354821,0.89871508,-0.17163931],[-0.20177411,0.83315469,-0.51491792],[-0.40354821,0.55543646,-0.72707577],[-0.20177411,0.27771823,-0.93923362],[0.2017741,0.27771823,-0.93923362],[0.40354821,0.55543646,-0.72707577],[0.20177411,0.83315469,-0.51491792]],"s":[[0,5,19,20,6],[0,6,7,8,9,1],[0,1,2,3,4,5],[1,9,10,11,2],[2,11,12,13,14,3],[3,14,15,16,4],[4,16,17,18,19,5],[6,20,37,38,21,7],[7,21,22,23,8],[8,23,24,25,10,9],[10,25,26,27,12,11],[12,27,28,29,13],[13,29,30,31,15,14],[15,31,32,33,17,16],[17,33,34,35,18],[18,35,36,37,20,19],[21,38,52,53,39,22],[22,39,40,41,24,23],[24,41,42,26,25],[26,42,43,44,28,27],[28,44,45,46,30,29],[30,46,47,32,31],[32,47,48,49,34,33],[34,49,50,51,36,35],[36,51,52,38,37],[39,53,54,55,40],[40,55,56,43,42,41],[43,56,57,45,44],[45,57,58,48,47,46],[48,58,59,50,49],[50,59,54,53,52,51],[54,59,58,57,56,55]]}
		} ;
		if(!m[param.shape]) return null ;
		var vt = m[param.shape].v ;
		var si = m[param.shape].s ;
		var vi = 0 ;
		for(var i =0;i<si.length;i++) {
			var nx=0,ny=0,nz=0 ;
			var vs = [] ;
			for(var h = si[i].length-1 ;h>=0;h--) {
				var v = vt[si[i][h]] ;
				p.push([v[0],v[2],v[1]]) ;
				nx += v[0] ;
				ny += v[2] ;
				nz += v[1] ;
				vs.push(vi) ;
				vi++ ;
			}
			var vl = Math.sqrt(nx*nx+ny*ny+nz*nz) ;
			for(var h = 0 ;h <si[i].length;h++) n.push([nx/vl,ny/vl,nz/vl]) ;
			s.push(vs) ;
		}
		t = null ;
		break ;
	}
	this.obj_v = p 
	this.obj_n = n
	this.obj_t = t
	this.obj_i = s
//	console.log(p)
//	console.log(n)
//	console.log(t)
//	console.log(s)
	return this ;
}
// generate parametric model by function
WWModel.prototype.parametricModel =function(func,pu,pv,opt) {
	var pos = [] ;
	var norm = [] ;
	var uv = [] ;
	var indices = [] ;
	var ninv = (opt && opt.ninv)?-1:1 ;

	var du = (pu.end - pu.start)/pu.div ;
	var dv = (pv.end - pv.start)/pv.div ;
	for(var iu =0; iu <= pu.div ;iu++ ) {
		for(var iv = 0 ;iv<= pv.div; iv++ ) {
			var u = pu.start+du*iu ;
			var v = pv.start+dv*iv ;
			var p = func(u,v) ;
			pos.push( [p.px,p.py,p.pz] ) ;
			if(p.mu!=undefined) uv.push([p.mu,p.mv]) ;
			// calc normal
			if(p.nx==0&&p.ny==0&&p.nz==0) {
				var dud = du/10 ; var dvd = dv/10 ;
				var du0 = func(u-dud,v) ; var du1 = func(u+dud,v) ;
				var nux = (du1.px - du0.px)/(dud*2) ;
				var nuy = (du1.py - du0.py)/(dud*2) ;
				var nuz = (du1.pz - du0.pz)/(dud*2) ;
				var dv0 = func(u,v-dvd) ; var dv1 = func(u,v+dvd) ;
				var nvx = (dv1.px - dv0.px)/(dvd*2) ;
				var nvy = (dv1.py - dv0.py)/(dvd*2) ;
				var nvz = (dv1.pz - dv0.pz)/(dvd*2) ;
				var nx = nuy*nvz - nuz*nvy ;
				var ny = nuz*nvx - nux*nvz ;
				var nz = nux*nvy - nuy*nvx ;
				var nl = Math.sqrt(nx*nx+ny*ny+nz*nz); 
				p.nx = nx/nl ;
				p.ny = ny/nl ;
				p.nz = nz/nl ;
			}
			norm.push([p.nx*ninv, p.ny*ninv,p.nz*ninv] ) ;
		}
	}
	var d2 = pv.div+1 ;
	for(var j = 0 ; j < pu.div ; ++j) {
		var base = j * d2;
		for(var i = 0 ; i < pv.div ; ++i) {
			if(ninv>0) indices.push([base+i,base+i+d2,base+i+d2+1,base+i+1])	
			else  indices.push([base+i+1,base+i+d2+1,base+i+d2,base+i])	
		}	

	}
	this.obj_v = pos
	this.obj_n = norm
	if(uv.length>0) this.obj_t = uv
	this.obj_i = indices 
	return this ;
}

// other utils 
WWModel.HSV2RGB = function( H, S, V ,a) {
	var ih;
	var fl;
	var m, n;
	var rr,gg,bb ;
	H = H * 6 ;
	ih = Math.floor( H );
	fl = H - ih;
	if( !(ih & 1)) fl = 1 - fl;
	m = V * ( 1 - S );
	n = V * ( 1 - S * fl );
	switch( ih ){
		case 0:
		case 6:
			rr = V; gg = n; bb = m; break;
		case 1: rr = n; gg = V; bb = m; break;
		case 2: rr = m; gg = V; bb = n; break;
		case 3: rr = m; gg = n; bb = V; break;
		case 4: rr = n; gg = m; bb = V; break;
		case 5: rr = V; gg = m; bb = n; break;
	}
	return [rr,gg,bb,(a===undefined)?1.0:a] ;
}
WWModel.snormal = function(pa) {
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
	return [xx,xy,xz] ;
}