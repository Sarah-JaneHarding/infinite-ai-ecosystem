function(p,e,c){
 var T=p.tasks||[]; if(!T.length) return H.need('No tasks.',['tasks']); var src=H.cited(p); if(!src.length) return H.noSrc();
 var F=['DEEPER_EXPLORATION','CHALLENGE_TASKS','CROSS_CURRICULAR','HIGHER_ORDER_THINKING'], f=c.extra.enrichmentFocus; if(F.indexOf(f)<0) return H.need('The agent contract asks for an enrichment focus (DEEPER_EXPLORATION, CHALLENGE_TASKS, CROSS_CURRICULAR or HIGHER_ORDER_THINKING). Type one.',['enrichmentFocus']);
 var r=H.readab(c); if(r.need) return H.needRead(r); if(r.out) return H.need('Measured reading grade is outside the target band.',['measuredGrade']);
 var o=H.artefact(p,c,e,'EXTENSION_PACK'); o.sections=[{title:p.focus||p.topic,enrichmentFocus:f,content:p.focus||p.topic,tasks:T.map(function(t){return t.task})}]; o.readabilityCheckResult=r.ok; o.citedSourceIds=src; return o;
}
