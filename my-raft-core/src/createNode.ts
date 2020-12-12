import {
  Config,
  LogEntry,
  Message,
  Node,
  NodeState,
  ProposeDataResponse,
} from "./types";
import clonedeep from "lodash.clonedeep";
import { Subject } from "rxjs";

export function createNode(config: Config): Node {
  let currentState: NodeState = {
    id: config.id,
    peers: config.peers,
    role: "follower",
    currentTerm: 1,
    votedFor: undefined,
    log: [],
    commitIndex: 0,
    lastApplied: 0,
    nextIndex: initMap(config.peers, 1),
    matchIndex: initMap(config.peers, 0),

    leaderId: undefined,
    electionElasped: 0,
    hearbeatElasped: 0,
    heartbeatTimeout: config.heartbeatTick,
    electionTimeout: config.electionTick,
    randomizedElectionTimeout: 0,
    outgoingMessages: [],
    voteGranted: initMap(config.peers, false),
  };
  let observables = {
    commited$: new Subject<LogEntry>(),
    roleChanged$: new Subject<NodeState>(),
    messageSent$: new Subject<Message>(),
  };
  let tickFunction: () => void;

  becomeFollower(1);

  function getState(): NodeState {
    return clonedeep(currentState);
  }

  function getObservables() {
    return Object.assign({}, observables);
  }

  function tick(): void {
    tickFunction();
  }

  function stop(): void {
    observables.commited$.complete();
    observables.roleChanged$.complete();
    observables.messageSent$.complete();
  }

  function tickElection(): void {
    currentState.electionElasped++;
    if (
      currentState.electionElasped >= currentState.randomizedElectionTimeout
    ) {
      currentState.electionElasped = 0;
      campaign();
    }
  }

  function tickHearbeat(): void {
    currentState.hearbeatElasped++;
    if (currentState.hearbeatElasped >= currentState.heartbeatTimeout) {
      currentState.hearbeatElasped = 0;
      for (const peer of config.peers) {
        sendHeartbeat(peer);
      }
    }
  }

  function campaign(): void {
    becomeCandidate();
    for (const peer of config.peers) {
      sendRequestVote(peer);
    }
  }

  function propose(data: string): ProposeDataResponse {
    let success = false;
    if (currentState.role === "leader") {
      currentState.log.push({
        data: data,
        term: currentState.currentTerm,
      });
      success = true;
    }
    return {
      leaderId: currentState.leaderId,
      success: success,
    };
  }

  function send(message: Message): void {
    currentState.outgoingMessages.push(message);
    observables.messageSent$.next(message);
  }

  function sendRequestVote(to: number): void {
    send({
      type: "RequestVoteRequest",
      from: config.id,
      to: to,
      term: currentState.currentTerm,
      lastLogIndex: currentState.log.length,
      lastLogTerm: logTerm(currentState.log.length),
    });
  }

  function sendHeartbeat(to: number): void {
    const prevIndex = currentState.nextIndex[to] - 1;
    const batchSize = config.appendEntriesBatchSize
      ? config.appendEntriesBatchSize
      : 1;
    const lastIndex = Math.min(prevIndex + batchSize, currentState.log.length); // last of the logs, or allowed batch
    send({
      type: "AppendEntriesRequest",
      from: config.id,
      to: to,
      term: currentState.currentTerm,
      leaderId: config.id,
      entries: currentState.log.slice(prevIndex, lastIndex),
      prevLogIndex: prevIndex,
      prevLogTerm: logTerm(prevIndex),
      leaderCommit: currentState.commitIndex,
    });
  }

  function logTerm(index: number) {
    if (index < 1 || index > currentState.log.length) {
      return 0;
    }
    return currentState.log[index - 1].term;
  }

  function isLogUpToDate(logIndex: number, term: number) {
    return (
      term > logTerm(currentState.log.length) ||
      (term === logTerm(currentState.log.length) &&
        logIndex >= currentState.log.length)
    );
  }

  function receive(message: Message): void {
    config.logger.info(
      `${config.id} received ${message.type} message from ${message.from}`
    );
    switch (message.type) {
      case "RequestVoteRequest":
        if (currentState.currentTerm < message.term) {
          // become follower and update currentTerm
          becomeFollower(message.term);
        }
        let granted = false;
        const sameTermCheck = currentState.currentTerm === message.term;
        const votedForCheck =
          currentState.votedFor === undefined ||
          currentState.votedFor === message.from;
        if (
          sameTermCheck &&
          votedForCheck &&
          isLogUpToDate(message.lastLogIndex, message.lastLogTerm)
        ) {
          granted = true;
          currentState.electionElasped = 0;
          currentState.votedFor = message.from;
        }
        send({
          type: "RequestVoteResponse",
          from: config.id,
          to: message.from,
          term: currentState.currentTerm,
          voteGranted: granted,
        });
        break;
      case "RequestVoteResponse":
        if (currentState.currentTerm < message.term) {
          becomeFollower(message.term);
        }
        if (
          currentState.role === "candidate" &&
          currentState.currentTerm === message.term
        ) {
          currentState.voteGranted[message.from] = message.voteGranted;

          if (message.voteGranted) {
            const totalGranted = Object.values(currentState.voteGranted).reduce(
              (sum, granted) => (granted ? sum + 1 : sum),
              0
            );
            if (totalGranted + 1 > majorityCount()) {
              becomeLeader();
            }
          }
        }
        break;
      case "AppendEntriesRequest":
        if (currentState.currentTerm < message.term) {
          becomeFollower(message.term, message.from);
        }
        let success = false;
        let matchIndex = 0;
        if (currentState.currentTerm === message.term) {
          becomeFollower(message.term, message.from);
          if (
            message.prevLogIndex === 0 || // leader node has sent every log, will always return success
            (message.prevLogIndex <= currentState.log.length &&
              logTerm(message.prevLogIndex) === message.prevLogTerm)
          ) {
            success = true;

            // merge entries
            let index = message.prevLogIndex + 1;
            for (const entry of message.entries) {
              if (
                index <= currentState.log.length &&
                logTerm(index) != entry.term
              ) {
                config.logger.info(
                  `${
                    config.id
                  } found conflict at index ${index} [existing term: ${logTerm(
                    index
                  )}, conflicting term: ${entry.term}]`
                );

                // clear from the conflict index
                while (currentState.log.length > index - 1) {
                  currentState.log.pop();
                }
              }
              currentState.log.push(entry);
              index++;
            }

            matchIndex = currentState.log.length; // index of last new entry

            if (message.leaderCommit > currentState.commitIndex) {
              currentState = {
                ...currentState,
                commitIndex: Math.min(message.leaderCommit, matchIndex),
              };
            }
          }
        }
        send({
          type: "AppendEntriesResponse",
          from: config.id,
          to: message.from,
          success: success,
          term: currentState.currentTerm,
          matchIndex: matchIndex,
        });
        break;
      case "AppendEntriesResponse":
        if (currentState.currentTerm < message.term) {
          becomeFollower(message.term, message.from);
        }
        if (
          currentState.role === "leader" &&
          currentState.currentTerm === message.term
        ) {
          if (message.success) {
            currentState.matchIndex[message.from] = Math.max(
              currentState.matchIndex[message.from],
              message.matchIndex
            );
            currentState.nextIndex[message.from] =
              currentState.matchIndex[message.from] + 1;
            advanceCommitIndex();
          } else {
            // decrement nextIndex, since prevLogTerm and prevLogIndex does not match
            currentState.nextIndex[message.from] = Math.max(
              1,
              currentState.nextIndex[message.from] - 1
            );
          }
        }
        break;
      default:
        throw new Error(
          `Received unexpected message type "${(message as Message).type}"`
        );
    }
  }

  function advanceCommitIndex(): void {
    // get all peers and itself match indexes
    const matchIndexes = Object.values(currentState.matchIndex).concat(
      currentState.log.length
    );
    // sort ascending
    matchIndexes.sort((a, b) => a - b);

    const commited = matchIndexes[majorityCount()];
    if (
      currentState.role === "leader" &&
      logTerm(commited) === currentState.currentTerm
    ) {
      if (currentState.commitIndex !== commited) {
        for (let i = currentState.commitIndex + 1; i <= commited; i++) {
          observables.commited$.next(currentState.log[i - 1]);
        }
        currentState.commitIndex = commited;
      }
    }
  }

  function reset(term: number) {
    if (term != currentState.currentTerm) {
      currentState.currentTerm = term;
      currentState.votedFor = undefined;
    }
    currentState.leaderId = undefined;
    currentState.electionElasped = 0;
    currentState.hearbeatElasped = 0;
    resetRandomizedElectionTimeout();
  }

  function resetRandomizedElectionTimeout() {
    currentState.randomizedElectionTimeout =
      currentState.electionTimeout +
      Math.floor(Math.random() * (currentState.electionTimeout - 1));
  }

  function becomeFollower(term: number, leaderId?: number) {
    reset(term);
    currentState = {
      ...currentState,
      role: "follower",
      leaderId: leaderId,
    };
    tickFunction = tickElection;
    config.logger.info(
      `${config.id} becomes follower at term ${currentState.currentTerm}`
    );
    observables.roleChanged$.next(getState());
  }

  function becomeCandidate() {
    if (currentState.role === "leader") {
      throw new Error("Invalid transition [leader -> candidate]");
    }
    reset(currentState.currentTerm + 1);
    currentState = {
      ...currentState,
      role: "candidate",
      votedFor: config.id,
      voteGranted: initMap(config.peers, false),
    };
    tickFunction = tickElection;
    config.logger.info(
      `${config.id} becomes candidate at term ${currentState.currentTerm}`
    );
    observables.roleChanged$.next(getState());
  }

  function becomeLeader() {
    reset(currentState.currentTerm);
    currentState = {
      ...currentState,
      role: "leader",
      leaderId: config.id,
      nextIndex: initMap(config.peers, currentState.log.length + 1),
      matchIndex: initMap(config.peers, 0),
    };
    tickFunction = tickHearbeat;
    config.logger.info(
      `${config.id} becomes leader at term ${currentState.currentTerm}`
    );
    observables.roleChanged$.next(getState());
  }

  function majorityCount() {
    return Math.floor((config.peers.length + 1) / 2);
  }

  return {
    getState,
    getObservables,
    tick,
    stop,
    receive,
    campaign,
    propose,
  };
}

function initMap<K extends keyof any, V>(keys: K[], value: V): Record<K, V> {
  const map: Record<K, V> = {} as any;
  keys.forEach((key) => {
    map[key] = value;
  });
  return map;
}
