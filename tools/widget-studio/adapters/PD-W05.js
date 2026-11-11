function(p,e,c){
 var G=(p.gaps||[]).slice().sort(function(a,b){return a.priority-b.priority}); if(!G.length) return H.need('No gaps in the output.',['gaps']);
 var top=G[0].score||1, kind={'Coaching':'coaching_cycle','Peer observation':'peer_observation','Resource':'resource_provision'};
 function conv(g){var so=(g.supportOptions||[])[0]||{},k=String(so.kind||'').toLowerCase();
  var t=k.indexOf('coach')>=0?'coaching_cycle':k.indexOf('peer')>=0?'peer_observation':k.indexOf('resource')>=0?'resource_provision':'micro_course';
  return {area:g.label,urgency:g.score>=top*0.8?'high':g.score>=top*0.5?'medium':'low',rationale:(g.scoreParts||[]).map(function(s){return s.why+' ('+s.points+')'}).join(', ')+'. '+((g.evidence||[])[0]||{}).summary,suggestedInterventionType:t}}
 var o=H.base(c); o.status='ok'; o.priorityGaps=G.map(conv); o.topPriorityGap=o.priorityGaps[0];
 o.summary=G.length+' gap(s) ranked by evidence score. Support types are options, not instructions. AI drafts; the PD coordinator decides.'; return o;
}
