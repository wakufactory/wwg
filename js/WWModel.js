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
WWModel.prototype.loadObj = function(path) {
	var self = this ;
	return new Promise(function(resolve,reject) {
		self.loadAjax(path).then(function(data) {
//			console.log(data) ;
			var l = data.split("\n") ;
			var v = [];
			var x = [] ;
			for(var i = 0;i<l.length;i++) {
				var ll = l[i].split(" ") ;
				if(ll[0].match(/\w*v\w*/i)) {
					v.push([ll[1],ll[2],ll[3]]) ;
				}
				if(ll[0].match(/\w*f\w*/i)) {
					x.push([ll[1]-1,ll[2]-1,ll[3]-1]) ;
				}
			}
			self.obj_v = v ;
			self.obj_i = x ;
			resolve(self.objNorm()) ;
		})
	}) ;
}
WWModel.prototype.objNorm  = function() {
	var scale = 1.0 ;
	var v = this.obj_v ;
	var s = this.obj_i ;
	var vbuf = [] ;
	var ibuf = [] ;
	var sf = [] ;
	var sn = [] ;
	var ii = 0 ;
	for(var i=0;i<s.length;i++) {
		var p = s[i] ;
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
		//3角分割
		for(var j=1;j<p.length-1;j++) {
			ibuf.push(p[0]) ;
			ibuf.push(p[j]) ;
			ibuf.push(p[j+1] ) ;

		}
		ii += p.length ;
	}
//	console.log(sn) ;

	for(var i=0;i<v.length;i++) {
		vbuf.push( v[i][0]*scale ) ;
		vbuf.push( v[i][1]*scale ) ;
		vbuf.push( v[i][2]*scale ) ;

		//面法線の合成
		var nx=0,ny=0,nz=0 ;
		for(var j=0;j<sn[i].length;j++) {
			var ii = sn[i][j] ;
			nx += sf[ii][0] ;
			ny += sf[ii][1] ;
			nz += sf[ii][2] ;
		}
		var vn = Math.sqrt(nx*nx+ny*ny+nz*nz) ;
		vbuf.push(nx/vn) ;
		vbuf.push(ny/vn) ;
		vbuf.push(nz/vn) ;
	}
//	console.log(vbuf) ;
//	console.log(ibuf) ;
	return {mode:"tri",vtx_at:["position","norm"],vtx:vbuf,idx:ibuf} ;
}