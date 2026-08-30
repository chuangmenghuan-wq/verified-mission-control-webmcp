export const scenarios = {
  sensors: {
    id:'sensors', label:'Sensor fulfillment', badge:'PROCUREMENT DEMO', description:'Fulfill 500 exact-model sensors under quantity, deadline, budget, and authority constraints.',
    goal:{ title:'Fulfill 500 exact-model sensors', seal:'500 units / 7 days / $8,500 / exact spec', constraints:[
      {id:'quantity',label:'Quantity',field:'quantity',op:'gte',value:500,display:'≥ 500 units',relaxable:false},
      {id:'deadline',label:'Deadline',field:'days',op:'lte',value:7,display:'≤ 7 days',relaxable:true},
      {id:'budget',label:'Base budget',field:'cost',op:'lte',value:8500,display:'≤ $8,500',relaxable:true},
      {id:'spec',label:'Specification',field:'spec',op:'eq',value:'exact',display:'Exact model',relaxable:true}
    ]},
    optionTitle:'Fragmented supplier market', optionIntro:'Every supplier solves some constraints and fails others.',
    options:[
      {name:'Atlas Components',meta:['300 units','6 days','$4,500','exact spec'],note:'On time, but only 300 units.'},
      {name:'Beacon Industrial',meta:['500 units','11 days','$8,400','exact spec'],note:'Full quantity, but 4 days late.'},
      {name:'Cobalt Supply',meta:['200 units','6 days','$5,900','exact spec'],note:'Fills the gap, but expensive.'},
      {name:'Delta Motion',meta:['500 units','5 days','$8,200','substitute'],note:'Fast, but changes the model.'}
    ],
    candidates:[
      {id:'sensor_budget',label:'Preserve deadline + exact spec',composition:['Atlas 300','Cobalt 200'],metrics:{quantity:500,days:6,cost:10400,spec:'exact'},preference:1,tradeoff:'Budget +$1,900',summary:'Split suppliers; quantity, deadline, and exact specification are preserved.'},
      {id:'sensor_deadline',label:'Preserve budget + exact spec',composition:['Beacon 500'],metrics:{quantity:500,days:11,cost:8400,spec:'exact'},preference:2,tradeoff:'Deadline +4 days',summary:'Cheapest exact-spec plan, but it misses the original deadline.'},
      {id:'sensor_spec',label:'Preserve deadline + budget',composition:['Delta 500'],metrics:{quantity:500,days:5,cost:8200,spec:'substitute'},preference:3,tradeoff:'Substitute model',summary:'Fast and under budget, but the sensor model changes.'},
      {id:'sensor_partial_a',label:'Atlas only',composition:['Atlas 300'],metrics:{quantity:300,days:6,cost:4500,spec:'exact'},preference:4,tradeoff:'Quantity shortfall',summary:'Cannot satisfy the non-relaxable quantity requirement.'},
      {id:'sensor_partial_b',label:'Atlas + reserve',composition:['Atlas 300','Echo 100'],metrics:{quantity:400,days:6,cost:5700,spec:'exact'},preference:5,tradeoff:'Quantity shortfall',summary:'Still below the required quantity.'},
      {id:'sensor_multi_a',label:'Atlas + Delta',composition:['Atlas 300','Delta 500'],metrics:{quantity:800,days:6,cost:12700,spec:'substitute'},preference:6,tradeoff:'Budget + specification',summary:'Violates multiple relaxable constraints.'},
      {id:'sensor_multi_b',label:'Beacon + reserve',composition:['Beacon 500','Echo 100'],metrics:{quantity:600,days:11,cost:9600,spec:'exact'},preference:7,tradeoff:'Deadline + budget',summary:'Violates multiple relaxable constraints.'}
    ],
    recommendedPlanId:'sensor_budget',
    authorityByPlan:{
      sensor_budget:{id:'sensor_budget_auth',label:'Keep deadline + exact spec',rationale:'Allow budget up to $10,500, split orders, and up to 10% overbuy for bounded recovery.',constraints:{budget:{value:10500}},additionalConstraints:[{id:'quantity_max',label:'Maximum recovery quantity',field:'quantity',op:'lte',value:550,relaxable:false}]},
      sensor_deadline:{id:'sensor_deadline_auth',label:'Keep budget + exact spec',rationale:'Accept delivery up to 11 days while preserving budget and exact specification.',constraints:{deadline:{value:11}}},
      sensor_spec:{id:'sensor_spec_auth',label:'Keep deadline + budget',rationale:'Allow the approved substitute model while preserving deadline and budget.',constraints:{spec:{value:'substitute'}}}
    },
    disruption:{appliesTo:'sensor_budget',title:'Cobalt drops 200 → 150',copy:'The authorized plan now delivers only 450 units. Repair the 50-unit gap without reopening every decision.',event:'Cobalt availability fell from 200 to 150.'},
    repairCandidates:[
      {id:'sensor_repair_echo',composition:['Atlas 300','Cobalt 150','Echo Reserve 100'],metrics:{quantity:550,days:6,cost:10125,spec:'exact'},preference:1,summary:'Preserve the valid allocation and add Echo Reserve MOQ 100.'},
      {id:'sensor_repair_rush',composition:['Atlas 300','Cobalt 150','Premium Rush 50'],metrics:{quantity:500,days:5,cost:11200,spec:'exact'},preference:2,summary:'Exact quantity, but exceeds the authorized budget cap.'}
    ],
    metricDefs:[{field:'quantity',label:'units',format:v=>String(v)},{field:'days',label:'arrival',format:v=>`${v}d`},{field:'cost',label:'cost',format:v=>`$${v.toLocaleString()}`}],
    finalSummary:p=>`${p.metrics.quantity} exact-spec sensors · ${p.metrics.days} days · $${p.metrics.cost.toLocaleString()}`
  },
  deployment: {
    id:'deployment', label:'Production deployment', badge:'OPS DEMO', description:'Ship a production release under downtime, cost, rollback, and final-approval constraints.',
    goal:{ title:'Deploy release safely inside the change window', seal:'complete / ≤5 min downtime / ≤$1,500 / rollback ready', constraints:[
      {id:'complete',label:'Release outcome',field:'complete',op:'eq',value:true,display:'Deployment complete',relaxable:false},
      {id:'downtime',label:'Downtime',field:'downtime',op:'lte',value:5,display:'≤ 5 minutes',relaxable:true},
      {id:'budget',label:'Change cost',field:'cost',op:'lte',value:1500,display:'≤ $1,500',relaxable:true},
      {id:'rollback',label:'Rollback safety',field:'rollback',op:'eq',value:true,display:'Rollback ready',relaxable:true}
    ]},
    optionTitle:'Deployment strategy space', optionIntro:'Each rollout strategy preserves different operational constraints.',
    options:[
      {name:'Canary rollout',meta:['4 min downtime','$1,720','rollback ready'],note:'Safest path, but over budget.'},
      {name:'Staged rollout',meta:['8 min downtime','$1,200','rollback ready'],note:'Under budget, but exceeds downtime.'},
      {name:'Fast rollout',meta:['4 min downtime','$1,300','no rollback'],note:'Fast and cheap, but removes rollback safety.'},
      {name:'Partial rollout',meta:['3 min downtime','$800','rollback ready'],note:'Does not complete the release.'}
    ],
    candidates:[
      {id:'deploy_budget',label:'Preserve downtime + rollback',composition:['Canary rollout'],metrics:{complete:true,downtime:4,cost:1720,rollback:true},preference:1,tradeoff:'Budget +$220',summary:'Safest complete rollout; only the budget moves.'},
      {id:'deploy_downtime',label:'Preserve budget + rollback',composition:['Staged rollout'],metrics:{complete:true,downtime:8,cost:1200,rollback:true},preference:2,tradeoff:'Downtime +3 min',summary:'Preserves cost and rollback safety, but extends downtime.'},
      {id:'deploy_rollback',label:'Preserve downtime + budget',composition:['Fast rollout'],metrics:{complete:true,downtime:4,cost:1300,rollback:false},preference:3,tradeoff:'Rollback disabled',summary:'Fast and cheap, but removes the rollback safety constraint.'},
      {id:'deploy_partial',label:'Partial rollout',composition:['Partial rollout'],metrics:{complete:false,downtime:3,cost:800,rollback:true},preference:4,tradeoff:'Incomplete outcome',summary:'Fails the non-relaxable release outcome.'},
      {id:'deploy_multi_a',label:'Big-bang rollout',composition:['Big-bang rollout'],metrics:{complete:true,downtime:9,cost:950,rollback:false},preference:5,tradeoff:'Downtime + rollback',summary:'Violates two relaxable constraints.'},
      {id:'deploy_cost_worse',label:'Dual-region canary',composition:['Dual-region canary'],metrics:{complete:true,downtime:3,cost:2100,rollback:true},preference:6,tradeoff:'Budget +$600',summary:'Same budget trade-off, but worse than the canary path.'},
      {id:'deploy_multi_b',label:'Emergency push',composition:['Emergency push'],metrics:{complete:true,downtime:7,cost:1750,rollback:false},preference:7,tradeoff:'Downtime + budget + rollback',summary:'Violates multiple constraints.'}
    ],
    recommendedPlanId:'deploy_budget',
    authorityByPlan:{
      deploy_budget:{id:'deploy_budget_auth',label:'Keep downtime + rollback',rationale:'Allow change cost up to $1,800 while preserving ≤5 minutes downtime and rollback readiness.',constraints:{budget:{value:1800}}},
      deploy_downtime:{id:'deploy_downtime_auth',label:'Keep budget + rollback',rationale:'Allow downtime up to 8 minutes while preserving budget and rollback readiness.',constraints:{downtime:{value:8}}},
      deploy_rollback:{id:'deploy_rollback_auth',label:'Keep downtime + budget',rationale:'Allow this deployment without rollback readiness while preserving downtime and budget.',constraints:{rollback:{value:false}}}
    },
    disruption:{appliesTo:'deploy_budget',title:'Canary West health check fails',copy:'The rollout is still recoverable. Mission Control must repair the plan without exceeding the approved cost, downtime, or rollback envelope.',event:'Canary West became unhealthy during rollout.'},
    repairCandidates:[
      {id:'deploy_repair_reroute',composition:['Canary East','Traffic reroute','Slower ramp'],metrics:{complete:true,downtime:5,cost:1780,rollback:true},preference:1,summary:'Reroute traffic and slow the ramp while keeping rollback ready.'},
      {id:'deploy_repair_restart',composition:['Rollback','Full redeploy'],metrics:{complete:true,downtime:8,cost:1650,rollback:true},preference:2,summary:'Within cost, but exceeds the authorized downtime envelope.'},
      {id:'deploy_repair_force',composition:['Force rollout'],metrics:{complete:true,downtime:4,cost:1600,rollback:false},preference:3,summary:'Within time and cost, but violates rollback safety.'}
    ],
    metricDefs:[{field:'downtime',label:'downtime',format:v=>`${v}m`},{field:'cost',label:'cost',format:v=>`$${v.toLocaleString()}`},{field:'rollback',label:'rollback',format:v=>v?'ready':'off'}],
    finalSummary:p=>`Deployment complete · ${p.metrics.downtime} min downtime · $${p.metrics.cost.toLocaleString()} · rollback ${p.metrics.rollback?'ready':'off'}`
  }
};

export const defaultScenarioId = 'sensors';
