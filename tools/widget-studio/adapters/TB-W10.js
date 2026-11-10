function(p,e,c){
 var S=p.steps||[]; if(!S.length) return H.need('No steps.',['steps']); var src=H.cited(p); if(!src.length) return H.noSrc();
 var r=H.readab(c); if(r.need) return H.needRead(r); if(r.out) return H.need('Measured reading grade is outside the target band.',['measuredGrade']);
 var o=H.artefact(p,c,e,'ACTIVITY_PLAN'); o.activityTitle=p.topic+' activity'; o.overview='Activity for '+p.classSize+' learners, '+p.totalMinutes+' minutes.'; o.materials=(p.materialsUsed||[]).slice();
 o.steps=S.map(function(s){return {instruction:s.teacher+' Learners: '+s.learners,durationMinutes:s.minutes}}); o.adaptations=[]; o.readabilityCheckResult=r.ok; o.citedSourceIds=src; return o;
}
