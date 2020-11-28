import { createNode } from "./createNode";
import {
  AppendEntriesRequest,
  AppendEntriesResponse,
  Config,
  LogEntry,
  Node,
  RequestVoteRequest,
  RequestVoteResponse,
} from "./types";

describe("create node", () => {
  test("node should be created as follower", () => {
    const node = createNode(getTestConfig(1));
    const state = node.getState();

    expect(state.role).toEqual("follower");
    expect(state.currentTerm).toEqual(1);
    expect(state.log).toEqual([]);
    expect(state.outgoingMessages).toEqual([]);

    expect(state.nextIndex).toEqual({
      2: 1,
      3: 1,
    });
    expect(state.matchIndex).toEqual({
      2: 0,
      3: 0,
    });
    expect(state.voteGranted).toEqual({
      2: false,
      3: false,
    });
  });

  test("node tick should increase elasped tick", () => {
    const config = getTestConfig(1);
    const node = createNode(config);
    node.tick();

    const state = node.getState();
    expect(state.role).toEqual("follower");
    expect(state.electionTimeout).toEqual(config.electionTick);
    expect(state.randomizedElectionTimeout).toBeGreaterThanOrEqual(
      config.electionTick
    );
    expect(state.randomizedElectionTimeout).toBeLessThanOrEqual(
      config.electionTick * 2 - 1
    );
    expect(state.electionElasped).toEqual(1);

    expect(state.heartbeatTimeout).toEqual(config.heartbeatTick);
    expect(state.hearbeatElasped).toEqual(0);
  });

  test("node get state returns copy of its state", () => {
    const node = createNode(getTestConfig(1));

    const state = node.getState();
    state.role = "leader";
    state.log.push({
      data: "test",
      term: 1,
    });

    expect(node.getState().role).toEqual("follower");
    expect(node.getState().log).toEqual([]);
  });

  test("node should throw error if receive invalid message", () => {
    const node = createNode(getTestConfig(1));
    expect(() => {
      node.receive({
        type: "Invalid",
      } as any);
    }).toThrowError(`Received unexpected message type "Invalid"`);
  });

  describe("propose data", () => {
    test("leader should return success response", () => {
      const node = createNode(getTestConfig(1));
      receiveVotesAndBecomeLeader(node);

      const response = node.propose("data1");
      expect(response.leaderId).toEqual(1);
      expect(response.success).toBeTruthy();
    });

    test("follower should return failure response and its leader id", () => {
      const node = createNode(getTestConfig(1));
      {
        const response = node.propose("data1");
        expect(node.getState().role).toEqual("follower");
        expect(response.leaderId).toBeUndefined();
        expect(response.success).toBeFalsy();
      }

      node.receive({
        type: "AppendEntriesRequest",
        from: 2,
        to: 1,
        entries: [],
        leaderCommit: 0,
        leaderId: 1,
        prevLogIndex: 0,
        prevLogTerm: 0,
        term: 2,
      } as AppendEntriesRequest);
      {
        const response = node.propose("data1");
        expect(node.getState().role).toEqual("follower");
        expect(response.leaderId).toEqual(2);
        expect(response.success).toBeFalsy();
      }
    });

    test("candidate should return failure response and without leader id", () => {
      const node = createNode(getTestConfig(1));
      node.campaign();

      const response = node.propose("data1");
      expect(node.getState().role).toEqual("candidate");
      expect(response.leaderId).toBeUndefined();
      expect(response.success).toBeFalsy();
    });
  });
});

describe("campaign for leader election", () => {
  test("node should change status to candidate", () => {
    const node = createNode(getTestConfig(1));
    node.campaign();

    {
      const state = node.getState();
      expect(state.currentTerm).toEqual(2);
      expect(state.votedFor).toEqual(1);
      expect(state.role).toEqual("candidate");
      expect(state.outgoingMessages).toEqual([
        {
          type: "RequestVoteRequest",
          from: 1,
          to: 2,
          term: 2,
          lastLogIndex: 0,
          lastLogTerm: 0,
        },
        {
          type: "RequestVoteRequest",
          from: 1,
          to: 3,
          term: 2,
          lastLogIndex: 0,
          lastLogTerm: 0,
        },
      ] as RequestVoteRequest[]);
    }
  });

  test("node as follower should campaign after required ticks", () => {
    const node = createNode(getTestConfig(1));
    for (let i = 0; i < node.getState().randomizedElectionTimeout - 1; i++) {
      node.tick();
    }
    expect(node.getState().role).toEqual("follower");

    node.tick();
    expect(node.getState().role).toEqual("candidate");
  });

  test("node as candidate should campaign again after required ticks", () => {
    const node = createNode(getTestConfig(1));
    node.campaign();
    for (let i = 0; i < node.getState().randomizedElectionTimeout - 1; i++) {
      node.tick();
    }
    expect(node.getState().role).toEqual("candidate");
    expect(node.getState().currentTerm).toEqual(2);

    node.tick();
    expect(node.getState().role).toEqual("candidate");
    expect(node.getState().currentTerm).toEqual(3);
  });

  test("node should vote for first candidates of same term vote request only, and vote for candiate have larger term", () => {
    const node = createNode(getTestConfig(1));
    node.receive({
      type: "RequestVoteRequest",
      from: 2,
      to: 1,
      term: 2,
      lastLogIndex: 0,
      lastLogTerm: 0,
    });

    {
      const state = node.getState();
      expect(state.votedFor).toEqual(2);
      expect(state.outgoingMessages).toEqual([
        {
          type: "RequestVoteResponse",
          from: 1,
          to: 2,
          term: 2,
          voteGranted: true,
        },
      ] as RequestVoteResponse[]);
    }

    node.receive({
      type: "RequestVoteRequest",
      from: 3,
      to: 1,
      term: 2,
      lastLogIndex: 0,
      lastLogTerm: 0,
    });
    {
      const state = node.getState();
      expect(state.votedFor).toEqual(2);
      expect(last(state.outgoingMessages)).toEqual({
        type: "RequestVoteResponse",
        from: 1,
        to: 3,
        term: 2,
        voteGranted: false,
      } as RequestVoteResponse);
    }

    node.receive({
      type: "RequestVoteRequest",
      from: 3,
      to: 1,
      term: 3, // higher term
      lastLogIndex: 0,
      lastLogTerm: 0,
    });
    {
      const state = node.getState();
      expect(state.votedFor).toEqual(3);
      expect(last(state.outgoingMessages)).toEqual({
        type: "RequestVoteResponse",
        from: 1,
        to: 3,
        term: 3,
        voteGranted: true,
      } as RequestVoteResponse);
    }
  });

  test("node should vote for same candidate if received request twice", () => {
    const node = createNode(getTestConfig(1));
    node.receive({
      type: "RequestVoteRequest",
      from: 2,
      to: 1,
      term: 2,
      lastLogIndex: 0,
      lastLogTerm: 0,
    });

    {
      const state = node.getState();
      expect(state.votedFor).toEqual(2);
      expect(state.outgoingMessages).toEqual([
        {
          type: "RequestVoteResponse",
          from: 1,
          to: 2,
          term: 2,
          voteGranted: true,
        },
      ] as RequestVoteResponse[]);
    }

    node.receive({
      type: "RequestVoteRequest",
      from: 2,
      to: 1,
      term: 2,
      lastLogIndex: 0,
      lastLogTerm: 0,
    });

    {
      const state = node.getState();
      expect(state.votedFor).toEqual(2);
      expect(state.outgoingMessages.length).toEqual(2);
      expect(last(state.outgoingMessages)).toEqual({
        type: "RequestVoteResponse",
        from: 1,
        to: 2,
        term: 2,
        voteGranted: true,
      } as RequestVoteResponse);
    }
  });

  test("node should vote for candidate with more updated log (higher log index)", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);

    node.propose("data1");
    expect(node.getState().log).toEqual([
      {
        term: 2,
        data: "data1",
      },
    ] as LogEntry[]);

    // vote for higher log index
    node.receive({
      type: "RequestVoteRequest",
      from: 3,
      to: 1,
      term: 3, // same term
      lastLogTerm: 2,
      lastLogIndex: 2, // higher log index
    });
    expect(node.getState().votedFor).toEqual(3);
  });

  test("node should vote for candidate with more updated log (higher log term)", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);

    node.propose("data1");
    expect(node.getState().log).toEqual([
      {
        term: 2,
        data: "data1",
      },
    ] as LogEntry[]);

    // vote for higher log index
    node.receive({
      type: "RequestVoteRequest",
      from: 3,
      to: 1,
      term: 3, // same term
      lastLogTerm: 3, // higher log term
      lastLogIndex: 0, // lower log index
    });
    expect(node.getState().votedFor).toEqual(3);
  });

  test("node becomes leader if receive majority of votes", () => {
    const node = createNode(getTestConfig(1, [1, 2, 3, 4, 5]));
    node.campaign();

    node.receive({
      type: "RequestVoteResponse",
      from: 2,
      to: 1,
      term: 2,
      voteGranted: true,
    });
    {
      const state = node.getState();
      expect(state.role).toEqual("candidate");
      expect(state.voteGranted[2]).toBeTruthy();
    }

    node.receive({
      type: "RequestVoteResponse",
      from: 3,
      to: 1,
      term: 2,
      voteGranted: true,
    });
    {
      const state = node.getState();
      expect(state.role).toEqual("leader");
      expect(state.leaderId).toEqual(1);
      expect(state.voteGranted[2]).toBeTruthy();
      expect(state.voteGranted[3]).toBeTruthy();
    }
  });

  test("node receives not granted vote", () => {
    const node = createNode(getTestConfig(1, [1, 2, 3, 4, 5]));
    node.campaign();

    node.receive({
      type: "RequestVoteResponse",
      from: 2,
      to: 1,
      term: 2,
      voteGranted: false,
    });
    const state = node.getState();
    expect(state.role).toEqual("candidate");
    expect(state.voteGranted[2]).toBeFalsy();
  });

  test("node becomes follower from candidate if receive vote with higher term", () => {
    const node = createNode(getTestConfig(1));
    node.campaign();

    node.receive({
      type: "RequestVoteResponse",
      from: 2,
      to: 1,
      term: 3,
      voteGranted: false,
    });
    const state = node.getState();
    expect(state.role).toEqual("follower");
    expect(state.currentTerm).toEqual(3);
  });

  test("node becomes follower from leader if receive vote with higher term", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);

    node.receive({
      type: "RequestVoteResponse",
      from: 2,
      to: 1,
      term: 3,
      voteGranted: false,
    });
    const state = node.getState();
    expect(state.role).toEqual("follower");
    expect(state.currentTerm).toEqual(3);
  });

  test("node as leader should throw error if it starts campaign", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);

    expect(() => {
      node.campaign();
    }).toThrowError("Invalid transition [leader -> candidate]");
  });
});

describe("log replication", () => {
  test("leader node ticks will send out heartbeats to peers", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);
    tickAndSendHeartbeat(node);

    {
      const state = node.getState();
      expect(lastN(state.outgoingMessages, 2)).toEqual([
        {
          type: "AppendEntriesRequest",
          from: 1,
          to: 2,
          entries: [],
          leaderCommit: 0,
          leaderId: 1,
          prevLogIndex: 0,
          prevLogTerm: 0,
          term: 2,
        },
        {
          type: "AppendEntriesRequest",
          from: 1,
          to: 3,
          entries: [],
          leaderCommit: 0,
          leaderId: 1,
          prevLogIndex: 0,
          prevLogTerm: 0,
          term: 2,
        },
      ] as AppendEntriesRequest[]);
    }

    node.propose("data1");
    node.propose("data2");
    tickAndSendHeartbeat(node);

    {
      const state = node.getState();
      expect(lastN(state.outgoingMessages, 2)).toEqual([
        {
          type: "AppendEntriesRequest",
          from: 1,
          to: 2,
          entries: [{ data: "data1", term: 2 }],
          leaderCommit: 0,
          leaderId: 1,
          prevLogIndex: 0,
          prevLogTerm: 0,
          term: 2,
        },
        {
          type: "AppendEntriesRequest",
          from: 1,
          to: 3,
          entries: [{ data: "data1", term: 2 }],
          leaderCommit: 0,
          leaderId: 1,
          prevLogIndex: 0,
          prevLogTerm: 0,
          term: 2,
        },
      ] as AppendEntriesRequest[]);
    }
  });

  test("leader node can send log entries in batch to peers", () => {
    const node = createNode({ ...getTestConfig(1), appendEntriesBatchSize: 2 });
    receiveVotesAndBecomeLeader(node);

    node.propose("data1");
    node.propose("data2");
    node.propose("data3");
    tickAndSendHeartbeat(node);

    {
      const state = node.getState();
      expect(lastN(state.outgoingMessages, 2)).toEqual([
        {
          type: "AppendEntriesRequest",
          from: 1,
          to: 2,
          entries: [
            { data: "data1", term: 2 },
            { data: "data2", term: 2 },
          ],
          leaderCommit: 0,
          leaderId: 1,
          prevLogIndex: 0,
          prevLogTerm: 0,
          term: 2,
        },
        {
          type: "AppendEntriesRequest",
          from: 1,
          to: 3,
          entries: [
            { data: "data1", term: 2 },
            { data: "data2", term: 2 },
          ],
          leaderCommit: 0,
          leaderId: 1,
          prevLogIndex: 0,
          prevLogTerm: 0,
          term: 2,
        },
      ] as AppendEntriesRequest[]);
    }

    node.receive({
      type: "AppendEntriesResponse",
      from: 2,
      to: 1,
      matchIndex: 1,
      success: true,
      term: 2,
    } as AppendEntriesResponse);

    node.receive({
      type: "AppendEntriesResponse",
      from: 3,
      to: 1,
      matchIndex: 2,
      success: true,
      term: 2,
    } as AppendEntriesResponse);

    tickAndSendHeartbeat(node);
    {
      const state = node.getState();
      expect(lastN(state.outgoingMessages, 2)).toEqual([
        {
          type: "AppendEntriesRequest",
          from: 1,
          to: 2,
          entries: [
            { data: "data2", term: 2 },
            { data: "data3", term: 2 },
          ],
          leaderCommit: 2,
          leaderId: 1,
          prevLogIndex: 1,
          prevLogTerm: 2,
          term: 2,
        },
        {
          type: "AppendEntriesRequest",
          from: 1,
          to: 3,
          entries: [{ data: "data3", term: 2 }],
          leaderCommit: 2,
          leaderId: 1,
          prevLogIndex: 2,
          prevLogTerm: 2,
          term: 2,
        },
      ] as AppendEntriesRequest[]);
    }

    node.receive({
      type: "AppendEntriesResponse",
      from: 3,
      to: 1,
      matchIndex: 3,
      success: true,
      term: 2,
    } as AppendEntriesResponse);
    tickAndSendHeartbeat(node);
    {
      const state = node.getState();
      expect(last(state.outgoingMessages)).toEqual({
        type: "AppendEntriesRequest",
        from: 1,
        to: 3,
        entries: [],
        leaderCommit: 3,
        leaderId: 1,
        prevLogIndex: 3,
        prevLogTerm: 2,
        term: 2,
      } as AppendEntriesRequest);
    }
  });

  test("node as follower recognizes leader with hearbeat", () => {
    const node = createNode(getTestConfig(1));
    node.receive({
      type: "AppendEntriesRequest",
      from: 2,
      to: 1,
      entries: [],
      leaderCommit: 0,
      leaderId: 1,
      prevLogIndex: 0,
      prevLogTerm: 0,
      term: 2,
    } as AppendEntriesRequest);

    const state = node.getState();
    expect(state.role).toEqual("follower");
    expect(state.leaderId).toEqual(2);
    expect(state.currentTerm).toEqual(2);
  });

  test("node as candidate recognizes leader with hearbeat", () => {
    const node = createNode(getTestConfig(1));
    node.campaign();

    node.receive({
      type: "AppendEntriesRequest",
      from: 2,
      to: 1,
      entries: [],
      leaderCommit: 0,
      leaderId: 1,
      prevLogIndex: 0,
      prevLogTerm: 0,
      term: 2,
    } as AppendEntriesRequest);

    const state = node.getState();
    expect(state.role).toEqual("follower");
    expect(state.leaderId).toEqual(2);
    expect(state.currentTerm).toEqual(2);
  });

  test("node should return success response if previous log term matches", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);
    node.propose("data1");

    node.receive({
      type: "AppendEntriesRequest",
      from: 2,
      to: 1,
      entries: [{ data: "data2", term: 3 }],
      leaderCommit: 0,
      leaderId: 1,
      prevLogIndex: 1,
      prevLogTerm: 2, // same log term
      term: 3,
    } as AppendEntriesRequest);

    {
      const state = node.getState();
      expect(state.role).toEqual("follower");
      expect(state.leaderId).toEqual(2);
      expect(state.commitIndex).toEqual(0);
      expect(state.log).toEqual([
        { data: "data1", term: 2 },
        { data: "data2", term: 3 },
      ] as LogEntry[]);
      expect(last(state.outgoingMessages)).toEqual({
        type: "AppendEntriesResponse",
        from: 1,
        to: 2,
        matchIndex: 2,
        success: true,
        term: 3,
      } as AppendEntriesResponse);
    }

    node.receive({
      type: "AppendEntriesRequest",
      from: 2,
      to: 1,
      entries: [], // empty entries
      leaderCommit: 2,
      leaderId: 1,
      prevLogIndex: 2,
      prevLogTerm: 3,
      term: 3,
    } as AppendEntriesRequest);
    {
      const state = node.getState();
      expect(state.commitIndex).toEqual(2);
      expect(state.log).toEqual([
        { data: "data1", term: 2 },
        { data: "data2", term: 3 },
      ] as LogEntry[]);
      expect(last(state.outgoingMessages)).toEqual({
        type: "AppendEntriesResponse",
        from: 1,
        to: 2,
        matchIndex: 2,
        success: true,
        term: 3,
      } as AppendEntriesResponse);
    }
  });

  test("node should return success response if entire log is sent from leader, and conflicted entries will be overridden", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);
    node.propose("data1");

    node.receive({
      type: "AppendEntriesRequest",
      from: 2,
      to: 1,
      entries: [
        { data: "data1", term: 3 },
        { data: "data2", term: 3 },
      ],
      leaderCommit: 0,
      leaderId: 1,
      prevLogIndex: 0,
      prevLogTerm: 0,
      term: 3,
    } as AppendEntriesRequest);

    const state = node.getState();
    expect(state.role).toEqual("follower");
    expect(state.leaderId).toEqual(2);
    expect(state.log).toEqual([
      { data: "data1", term: 3 },
      { data: "data2", term: 3 },
    ] as LogEntry[]);
    expect(last(state.outgoingMessages)).toEqual({
      type: "AppendEntriesResponse",
      from: 1,
      to: 2,
      matchIndex: 2,
      success: true,
      term: 3,
    } as AppendEntriesResponse);
  });

  test("node should return failure response if previous log term does not match", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);
    node.propose("data1");

    node.receive({
      type: "AppendEntriesRequest",
      from: 2,
      to: 1,
      entries: [{ data: "data2", term: 3 }],
      leaderCommit: 0,
      leaderId: 1,
      prevLogIndex: 1,
      prevLogTerm: 3,
      term: 3,
    } as AppendEntriesRequest);

    const state = node.getState();
    expect(state.role).toEqual("follower");
    expect(state.leaderId).toEqual(2);
    expect(state.log).toEqual([{ data: "data1", term: 2 }] as LogEntry[]);
    expect(last(state.outgoingMessages)).toEqual({
      type: "AppendEntriesResponse",
      from: 1,
      to: 2,
      matchIndex: 0,
      success: false,
      term: 3,
    } as AppendEntriesResponse);
  });

  test("node should return failure response if leader's term is less than its term", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);
    node.propose("data1");

    node.receive({
      type: "AppendEntriesRequest",
      from: 2,
      to: 1,
      entries: [{ data: "data2", term: 3 }],
      leaderCommit: 0,
      leaderId: 1,
      prevLogIndex: 1,
      prevLogTerm: 3,
      term: 1,
    } as AppendEntriesRequest);

    const state = node.getState();
    expect(state.role).toEqual("leader");
    expect(state.leaderId).toEqual(1);
    expect(state.log).toEqual([{ data: "data1", term: 2 }] as LogEntry[]);
    expect(last(state.outgoingMessages)).toEqual({
      type: "AppendEntriesResponse",
      from: 1,
      to: 2,
      matchIndex: 0,
      success: false,
      term: 2,
    } as AppendEntriesResponse);
  });

  test("leader node should become follower if receives failure heartbeat response with higher term", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);

    node.receive({
      type: "AppendEntriesResponse",
      from: 2,
      to: 1,
      matchIndex: 0,
      success: false,
      term: 3,
    } as AppendEntriesResponse);

    const state = node.getState();
    expect(state.role).toEqual("follower");
    expect(state.leaderId).toEqual(2);
    expect(state.currentTerm).toEqual(3);
  });

  test("leader node updates match index for peer if receives success hearbeat response", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);

    node.receive({
      type: "AppendEntriesResponse",
      from: 2,
      to: 1,
      matchIndex: 1,
      success: true,
      term: 2,
    } as AppendEntriesResponse);

    const state = node.getState();
    expect(state.matchIndex[2]).toEqual(1);
    expect(state.nextIndex[2]).toEqual(2);
  });

  test("leader node advance commit index if received majority of match index", () => {
    const node = createNode(getTestConfig(1, [1, 2, 3, 4, 5]));
    receiveVotesAndBecomeLeader(node);
    node.propose("data1");
    node.propose("data2");

    node.receive({
      type: "AppendEntriesResponse",
      from: 2,
      to: 1,
      matchIndex: 1,
      success: true,
      term: 2,
    } as AppendEntriesResponse);
    node.receive({
      type: "AppendEntriesResponse",
      from: 3,
      to: 1,
      matchIndex: 2,
      success: true,
      term: 2,
    } as AppendEntriesResponse);

    {
      const state = node.getState();
      expect(state.matchIndex[2]).toEqual(1);
      expect(state.matchIndex[3]).toEqual(2);
      expect(state.commitIndex).toEqual(1);
    }

    node.receive({
      type: "AppendEntriesResponse",
      from: 4,
      to: 1,
      matchIndex: 2,
      success: true,
      term: 2,
    } as AppendEntriesResponse);
    {
      const state = node.getState();
      expect(state.matchIndex[2]).toEqual(1);
      expect(state.matchIndex[3]).toEqual(2);
      expect(state.matchIndex[4]).toEqual(2);
      expect(state.commitIndex).toEqual(2);
    }
  });

  test("leader node decreases next index of peer if receives failure hearbeat response", () => {
    const node = createNode(getTestConfig(1));
    receiveVotesAndBecomeLeader(node);
    node.propose("data1");
    node.propose("data2");

    // try replicate first log entry
    tickAndSendHeartbeat(node);
    {
      const state = node.getState();
      expect(last(state.outgoingMessages)).toEqual({
        type: "AppendEntriesRequest",
        from: 1,
        to: 3,
        entries: [{ data: "data1", term: 2 }],
        leaderCommit: 0,
        leaderId: 1,
        prevLogIndex: 0,
        prevLogTerm: 0,
        term: 2,
      } as AppendEntriesRequest);
    }

    // replicated first log entry
    node.receive({
      type: "AppendEntriesResponse",
      from: 3,
      to: 1,
      matchIndex: 1,
      success: true,
      term: 2,
    } as AppendEntriesResponse);

    {
      const state = node.getState();
      expect(state.matchIndex[3]).toEqual(1);
      expect(state.nextIndex[3]).toEqual(2);
    }

    // try replicate second log entry
    tickAndSendHeartbeat(node);
    {
      const state = node.getState();
      expect(last(state.outgoingMessages)).toEqual({
        type: "AppendEntriesRequest",
        from: 1,
        to: 3,
        entries: [{ data: "data2", term: 2 }],
        leaderCommit: 1,
        leaderId: 1,
        prevLogIndex: 1,
        prevLogTerm: 2,
        term: 2,
      } as AppendEntriesRequest);
    }

    // for some reason, peer does not match log index and returned failure response
    node.receive({
      type: "AppendEntriesResponse",
      from: 3,
      to: 1,
      matchIndex: 0,
      success: false,
      term: 2,
    } as AppendEntriesResponse);
    {
      const state = node.getState();
      expect(state.matchIndex[3]).toEqual(1);
      expect(state.nextIndex[3]).toEqual(1);
    }

    // start again try to replicate first log entry
    tickAndSendHeartbeat(node);
    {
      const state = node.getState();
      expect(last(state.outgoingMessages)).toEqual({
        type: "AppendEntriesRequest",
        from: 1,
        to: 3,
        entries: [{ data: "data1", term: 2 }],
        leaderCommit: 1,
        leaderId: 1,
        prevLogIndex: 0,
        prevLogTerm: 0,
        term: 2,
      } as AppendEntriesRequest);
    }
  });
});

function getTestConfig(id: number, allNodes?: number[]): Config {
  const nodes = allNodes ? allNodes : [1, 2, 3];
  if (!nodes.includes(id)) {
    throw new Error(`${id} is expected to be contained in ${allNodes}`);
  }
  return {
    id: id,
    peers: nodes.filter((i) => i !== id),
    electionTick: 10,
    heartbeatTick: 2,
    logger: {
      debug: () => {},
      error: () => {},
      info: () => {},
      trace: () => {},
      warn: () => {},
    },
  };
}

function receiveVotesAndBecomeLeader(node: Node) {
  if (node.getState().role !== "candidate") {
    node.campaign();
  }
  const state = node.getState();
  for (const peer of state.peers) {
    node.receive({
      type: "RequestVoteResponse",
      from: peer,
      to: state.id,
      term: state.currentTerm,
      voteGranted: true,
    });
  }
  expect(node.getState().role).toEqual("leader");
}

function tickAndSendHeartbeat(node: Node) {
  for (let i = 0; i < node.getState().heartbeatTimeout; i++) {
    node.tick();
  }
}

function last<T>(array: T[]) {
  return array[array.length - 1];
}

function lastN<T>(array: T[], n: number): T[] {
  if (n > array.length) {
    throw new Error(`array does not have ${n} items`);
  }
  return array.slice(-n);
}
