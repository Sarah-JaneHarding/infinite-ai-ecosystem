var H={
 base:function(c){return {tenantId:c.tenantId,generatedAt:c.now()}},
 need:function(detail,fields){return {status:'needs_input',detail:detail,missingFields:fields}},
 mean:function(a){return a.length?a.reduce(function(x,y){return x+y},0)/a.length:null},
 r2:function(x){return Math.round(x*100)/100},
 grade:function(id){var m=/^G(\d+|R)-/.exec(id||'');return m?m[1]:null},
 uniq:function(a){return a.filter(function(v,i){return a.indexOf(v)===i})},
 dt:function(s){return /^\d{4}-\d{2}-\d{2}T.*Z$/.test(s)?s:(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T00:00:00.000Z':null)},
 src:function(p){var o=[];(function w(x){if(!x||typeof x!=='object')return;if(Array.isArray(x))return x.forEach(w);Object.keys(x).forEach(function(k){if(k==='sourceRef'&&typeof x[k]==='string'&&o.indexOf(x[k])<0)o.push(x[k]);else w(x[k])})})(p);return o},
 cited:function(p){return H.src(p)},
 /* reading-grade check the agent asks for; the widget measures ease, not a grade, so the grade band comes from the person */
 readab:function(c){var x=c.extra,m=parseFloat(x.measuredGrade),lo=parseFloat(x.targetMinGrade),hi=parseFloat(x.targetMaxGrade);
  if(isNaN(m)||isNaN(lo)||isNaN(hi)) return {need:['measuredGrade','targetMinGrade','targetMaxGrade']};
  if(m<lo||m>hi) return {out:true,m:m,lo:lo,hi:hi};
  return {ok:{verdict:'within_band',measuredGrade:m,targetBand:{minGrade:lo,maxGrade:hi}}}},
 needRead:function(r){return H.need('The agent contract needs a measured reading grade and the target grade band; this widget measures reading ease, not a grade, and the band is a platform policy. Type them below.',r.need)},
 link:function(p){return {capsTopicId:p.capsTopicId}},
 artefact:function(p,c,e,type){var o=H.base(c);o.status='ok';o.artefactId=c.idFor(e.runId);o.artefactType=type;o.linkage=H.link(p);return o},
 noSrc:function(){return {status:'no_source_document',detail:'No source reference is attached to this output, so the agent contract cannot be met.'}}
};
