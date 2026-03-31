export interface CorrelationEngineDefinition {
  id: number;
  title: string;
  how: string;
  flow: string;
  requirement: string;
  solves: string;
  why: string;
  advanced?: boolean;
}

export const CORRELATION_ENGINE_DEFINITIONS: CorrelationEngineDefinition[] = [
  { id: 1, title: 'ServiceNow + Change Management', how: 'Map incidents to recent changes using timestamps and CI mapping.', flow: 'SNOW API -> Change logs -> KG link -> incident correlation', requirement: 'SNOW API + CMDB access', solves: 'Identifies change-induced outages', why: '~70% incidents are change-related' },
  { id: 2, title: 'SNOW + Vendor Device Config (Cisco/F5/etc)', how: 'Link incident CI and fetch device configuration diffs.', flow: 'SNOW -> CI -> connector -> config history -> KG', requirement: 'Device APIs + config versioning', solves: 'Finds misconfiguration root cause', why: 'Config drift is a major failure source' },
  { id: 3, title: 'SNOW + Monitoring Tools (Prometheus/Datadog)', how: 'Align incident timestamps with metric anomalies.', flow: 'Metrics -> anomaly detection -> incident mapping', requirement: 'Metrics APIs + synchronized timestamps', solves: 'Detects performance degradation causes', why: 'Metrics show impact while SNOW shows symptoms' },
  { id: 4, title: 'SNOW + Logs (ELK/Splunk)', how: 'Correlate incident windows with log spikes and error signatures.', flow: 'Log query -> error patterns -> KG linking', requirement: 'Log access + parsing pipeline', solves: 'Pinpoints exact failure events', why: 'Logs are the ground-truth event source' },
  { id: 5, title: 'SNOW + Vulnerability Data (Qualys/Tenable)', how: 'Match affected incident CIs with active vulnerabilities.', flow: 'Vulnerability data -> CI mapping -> incident link', requirement: 'Vulnerability scanner APIs', solves: 'Highlights exploit-induced outages', why: 'Security weaknesses often present as outages' },
  { id: 6, title: 'SNOW + Patch Management', how: 'Correlate patch timelines and version changes to incident onset.', flow: 'Patch history -> version mismatch -> KG', requirement: 'Patch inventory and timeline access', solves: 'Detects patch regression issues', why: 'Bad patches can break stable systems' },
  { id: 7, title: 'SNOW + Network Topology', how: 'Traverse dependency graph from affected CIs to connected services.', flow: 'KG traversal -> upstream/downstream impact mapping', requirement: 'Topology data (LLDP/CDP/cloud graph)', solves: 'Performs blast-radius analysis', why: 'One node failure can cascade widely' },
  { id: 8, title: 'SNOW + Cloud Events (AWS/Azure/GCP)', how: 'Map incidents to cloud control-plane and infra events.', flow: 'Cloud logs -> event stream -> KG correlation', requirement: 'CloudTrail/Activity Log equivalents', solves: 'Detects infra-level cloud failures', why: 'Cloud environments change rapidly and frequently' },
  { id: 9, title: 'SNOW + Authentication Systems (AD/Okta)', how: 'Correlate auth/login anomalies with incident windows.', flow: 'Auth logs -> anomaly detection -> incident mapping', requirement: 'Identity provider log access', solves: 'Detects access-related outages', why: 'Authentication failures impact entire workflows' },
  { id: 10, title: 'SNOW + DR/Backup Systems', how: 'Correlate backup/replication state with incident progression.', flow: 'DR logs -> replication sync status -> KG', requirement: 'DRaaS and backup APIs', solves: 'Detects recovery-failure scenarios', why: 'Recovery path reliability is critical during outages' },
  { id: 11, title: 'SNOW + CI/CD Pipelines', how: 'Link deployments and release artifacts to incident start time.', flow: 'CI/CD logs -> release metadata -> KG', requirement: 'GitHub/Jenkins pipeline APIs', solves: 'Detects deployment-induced incidents', why: 'Releases are a frequent trigger for regressions' },
  { id: 12, title: 'SNOW + Capacity / Resource Usage', how: 'Correlate CPU, memory, and saturation spikes with incidents.', flow: 'Infra metrics -> threshold breach -> KG correlation', requirement: 'Infrastructure monitoring feeds', solves: 'Detects resource-exhaustion root cause', why: 'Capacity pressure is a common hidden cause' },
  { id: 13, title: 'Multi-Source Correlation', how: 'Combine change, metrics, logs, and SNOW signals into one timeline.', flow: 'Ingestion -> normalization -> KG unified timeline', requirement: 'All connectors + strict time sync', solves: 'Finds true root cause instead of symptoms', why: 'Single-source analysis is often misleading', advanced: true },
  { id: 14, title: 'Temporal Correlation Engine', how: 'Align all evidence by sequence and event ordering.', flow: 'Event ingestion -> timestamp normalization -> time graph', requirement: 'NTP consistency across data sources', solves: 'Clarifies sequence-of-events', why: 'Incident causality depends on event order', advanced: true },
  { id: 15, title: 'Pattern-Based Correlation', how: 'Match active incidents against historical incident patterns.', flow: 'Historical KG -> similarity search -> pattern match', requirement: 'Persisted incident history and embeddings', solves: 'Accelerates RCA using known patterns', why: 'Recurring failures are common', advanced: true },
  { id: 16, title: 'AI-Assisted Correlation', how: 'Use reasoning on KG + retrieved evidence to infer hidden links.', flow: 'KG + RAG context -> reasoning layer -> ranked hypothesis', requirement: 'LLM integration + evidence-grounding controls', solves: 'Finds unknown and complex relationships', why: 'Humans miss cross-domain weak signals', advanced: true },
];
