# Primary-source CPU boundary

Apple's [XNU exit/reap source](https://raw.githubusercontent.com/apple-oss-distributions/xnu/xnu-11417.140.69/bsd/kern/kern_exit.c)
saves the exiting process's own usage plus its credited children at lines2280–2290.
Reaping adds that combined usage to the parent's child accumulator at
lines2554–2566. Ignoring SIGCHLD can prevent roll-up. Missing exit usage is not
complete accounting.

Apple's [XNU resource source](https://raw.githubusercontent.com/apple-oss-distributions/xnu/xnu-11417.140.69/bsd/kern/kern_resource.c)
returns that child accumulator for RUSAGE_CHILDREN at lines1516–1521. Its
ruadd function sums user/system times and takes the larger maxrss at
lines1539–1547. Thus a waited Node parent can carry its waited Python children
to the fresh owner. Do not add their reported times again.

The installed Apple SDK wait(2) manual states wait4's usage covers the terminated
process and its children. Installed getrusage(2) labels maxrss in bytes. Both
files and the resource header are pinned. Public source describes the mechanism;
the fixed synthetic cases qualify the actual pinned local Darwin behavior.

Node's pinned-version [libuv process source](https://raw.githubusercontent.com/nodejs/node/v22.19.0/deps/uv/src/unix/process.c)
performs exact-child waitpid before its exit callback at lines120–161. The
synthetic Node code additionally waits close/EOF for all three spawned children
and exit for its Worker. Worker CPU is part of its one process and is not added
as a separate child.

The component reports controller SELF as a separate observed span. A later
external ancestor usage receipt may already include this controller and its
waited descendants; combining those inclusive roots would double count them.
Incomplete descendant credit remains UNKNOWN even if some process CPU is
observable. These are CPU semantics, not a memory or real-physics qualification.
