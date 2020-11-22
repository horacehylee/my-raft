interface LogEntry {
  data: string;
  term: number;
}

export interface Config {
  id: number;

  /**
   * peer ids for the cluster
   */
  peers: number[];

  /**
   * number of ticks invocations that must pass between elections
   * if a follower does not receive any message from the leader before electionTick ticks have elapsed,
   * it will become candidate and start an election.
   */
  electionTick: number;

  /**
   * number of ticks that must pass between heartbeats.
   * A leader send heartbeat messages to maintain its leadership every heartbeatTick ticks have elasped.
   */
  heartbeatTick: number;
}

export interface NodeState {
  /**
   * status of the current node, initialized as "follower"
   */
  status: "follower" | "candidate" | "leader";

  /**
   * latest term node has seen (initialized as 0)
   */
  currentTerm: number;

  /**
   * candidate id that received vote in current term (undefined if none)
   */
  votedFor?: number;

  /**
   * log entries; each entry contains command for state machine, and term when entry was received by leader
   */
  log: LogEntry[];

  /**
   * index of highest log entry known to be commited
   */
  commitIndex: number;

  /**
   * index of highlest log entry applied to state machine
   */
  lastApplied: number;

  /**
   * for each peer, index of next log entry to be send to it (initialized to leader last log index + 1)
   * Volatile state on leaders (Reinitialized after election)
   */
  nextIndex: Record<number, number>;

  /**
   * for each peer, index of highest log entry known to be replicated on peer (initialized to 0)
   * Volatile state on leaders (Reinitialized after election)
   */
  matchIndex: Record<number, number>;

  isLeader: boolean;
  leaderId?: number;
  electionElasped: number;
  hearbeatElasped: number;
  heartbeatTimeout: number;
  electionTimeout: number;

  /**
   * random number between [electionTimeout, 2 * electionTimeout - 1]
   * reset when raft changes state to follower or candidate
   */
  randomizedElectionTimeout: number;
}

/**
 * Raft node instance
 */
export interface Node {
  /**
   * get a readonly state snapshot
   */
  getState(): NodeState;

  /**
   * increment internal logical clock. Election and heartbeat timeouts are measured in number of ticks
   */
  tick(): void;

  /**
   * trigger transition to candidate state and start campaigning to become leader
   */
  campaign(): void;

  /**
   * propose data to be appended to log
   * @param data
   */
  propose(data: string): void;

  /**
   * stop the node
   */
  stop(): void;
}

/**
 * RequestVoteRequest is invoked by candidates to gather votes
 */
export interface RequestVoteRequest {
  term: number;
  candidateId: number;
  lastLogIndex: number;
  lastLogTerm: number;
}

export interface RequestVoteResponse {
  /**
   * currentTerm, for candidate to update itself
   */
  term: number;
  voteGranted: boolean;
}

/**
 * AppendEntriesRequest is invoked by leader to replicate log entries, also used as heartbeat
 */
export interface AppendEntriesRequest {
  term: number;
  leaderId: number;
  prevLogIndex: number;
  prevLogTerm: number;

  /**
   * log entries to store/replicate (empty for hearbeat)
   */
  entries: LogEntry[];
  leaderCommit: number;
}

export interface AppendEntriesResponse {
  /**
   * currentTerm, for leader to update itself
   */
  term: number;

  /**
   * true if follower container entry matching prevLogIndex and prevLogTerm
   */
  success: boolean;
}
