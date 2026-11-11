function(p,e,c){
 if(!p.passage) return {status:'no_source_document',detail:'There is no passage.'}; var src=H.cited(p); if(!src.length) return H.noSrc();
 var r=H.readab(c); if(r.need) return H.needRead(r);
 if(r.out) {var q=H.base(c);q.status='readability_out_of_band';q.measuredGrade=r.m;q.targetBand={minGrade:r.lo,maxGrade:r.hi};q.detail='The passage reads outside the target grade band.';delete q.tenantId;delete q.generatedAt;return {status:q.status,measuredGrade:q.measuredGrade,targetBand:q.targetBand,detail:q.detail};}
 var o=H.artefact(p,c,e,'READING_PASSAGE'); o.title=p.header||p.topic; o.body=p.passage; o.wordCount=(p.readability&&p.readability.words)||p.passage.split(/\s+/).filter(Boolean).length;
 o.readabilityCheckResult=r.ok; o.isDecodable=!(p.notDecodable&&p.notDecodable.length); o.citedSourceIds=src; return o;
}
