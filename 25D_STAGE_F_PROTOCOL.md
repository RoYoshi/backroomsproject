# Stage F protocol v1

Transport: retained WebSocket; retained fixed 60Hz simulation, 25ms room wake and
snapshot every two wakes (~20Hz). Spatial messages are opt-in for host-selected
`TFB_WORLD` canonical JSON; default Level 0 is explicit flat-compat.

| Envelope | Contract |
|---|---|
| hello/world manifest | version 1; spatial-pose-v1, ordered-proposals-v1, explicit-epochs-v1; worldEpoch; geometry mode/schema/revision/hash; motion revision; integer simTick; sorted support/surface/link IDs |
| pose | epoch; entityId + generation; seq/tick/discontinuity; XYZ and XYZ velocity; yaw; physical height/profile; support/navSurface; mode; link/progress; bounded step/traversal/vault primitive state |
| sp proposal | epoch/hash; life; ordered seq; correction ack; 1–15 ordered fixed-tick samples with claimed pose/velocity/support and posture/optional gait/traversal intent |
| correction | cause, complete authoritative pose, epoch/life/discontinuity; pending prediction discarded at explicit boundary |
| action | epoch/life/ack for spatial lifecycle/admin actions; actual permission checks retained |

Client Z/support are claims; the server derives physical results through canonical
world_motion and geometry. Full precision is retained. Finite wire pose velocity
bound is 2000; this is not an allowed grounded speed. Per-posture grounded envelopes
and earned distance debt remain stricter. References are bounded strings <=128;
coordinates <=1e7; sample/history/queue/work limits are explicit in LIMIT.

Protocol/capability or geometry/schema/hash/motion mismatch produces explicit
incompatibility. A flat client cannot silently enter a spatial server. Generation,
world and correction identities reject stale actions and movement. A future client
tick cannot manufacture elapsed time. 90-tick queue/history/credit bound; 15 room-wake
validation budget. Backlogs reconcile rather than trigger unlimited replay.

Common history: `(worldEpoch, entityId, generation)`, eight samples per entity,
100ms presentation delay, <=150ms support-safe extrapolation; old inactive entries
expire after 300 simulation ticks. Discontinuity resets history; ordinary jitter
does not. Supported segments reconstruct support, timed/free primitives use shared
motion, and unknown transitions hold instead of blending through slabs.

Inbound spatial JSON frames <16,384 bytes; output extended frame limit 524,288.
The retained transport now encodes extended frames above 65,535 bytes so a large
spatial snapshot is not silently dropped. Worst-case measured framing fixture is
separate from unfrozen AI/CPU workloads. Corpse/equipment spatial replication and
complete production presentation remain Stage G/H responsibilities.
