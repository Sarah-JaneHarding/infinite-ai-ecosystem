function(p,e,c){
 var T=p.topics||[]; if(!T.length) return H.need('No topics in the pacing output.',['topics']);
 var g=H.uniq(T.map(function(t){return H.grade(t.capsTopicId)}).filter(Boolean)); if(g.length!==1) return H.need('One grade is needed; found '+(g.length?g.join(', '):'none')+'. Run the widget for one grade.',['gradeLabel']);
 if(!c.extra.periodStart||!c.extra.periodEnd) return H.need('The agent contract needs the period dates as calendar dates; the widget only knows ATP weeks (term '+p.term+').',['periodStart','periodEnd']);
 var ws=T.map(function(t){return t.atpStartWeek}).concat(T.map(function(t){return t.atpEndWeek}));
 var behind=T.filter(function(t){return t.behind}).length, ahead=T.filter(function(t){return (t.driftWeeksMax||0)<0}).length;
 var gaps=(p.topicGaps||[]).map(function(t){return {capsTopicId:t.capsTopicId,deliveryStatus:(t.partlyTaught>0&&!t.notTaught)?'partially_delivered':'not_delivered',weeksBehind:Math.max(0,Math.round(t.driftWeeksMax||0))}});
 var o=H.base(c); o.status='ok'; o.subject=H.uniq(T.map(function(t){return t.subject})).join(', '); o.gradeLabel=g[0];
 o.periodStart=c.extra.periodStart; o.periodEnd=c.extra.periodEnd;
 o.topicsAnalysed=T.length; o.topicsBehind=behind; o.topicsAhead=ahead; o.topicsOnTrack=T.length-behind-ahead; o.meanWeeksDrift=H.r2((p.pacing&&p.pacing.meanDriftWeeks)||0);
 o.gapTopics=gaps; o.summary=T.length+' topics checked: '+o.topicsOnTrack+' on track, '+behind+' behind, '+ahead+' ahead. '+gaps.length+' with a gap. AI drafts; the HoD decides.'; return o;
}
