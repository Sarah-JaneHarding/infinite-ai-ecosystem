function(p,e,c){
 var S=p.sessions||[]; if(!S.length) return H.need('No sessions in the plan.',['sessions']);
 var o=H.base(c); o.status='ok'; o.planId=c.idFor(e.runId); o.targetGap=p.gapLabel;
 o.sessions=S.map(function(s){return {sessionNumber:s.sessionNo,focus:s.focus,openingPrompts:s.prompts||[],evidencePoints:s.evidenceToLookFor||[],estimatedMinutes:30}});
 o.goalStatement='Over '+S.length+' session(s), work on: '+p.gapLabel+'. Supportive, not for ranking.'; o.citedSourceIds=H.src(p); return o;
}
