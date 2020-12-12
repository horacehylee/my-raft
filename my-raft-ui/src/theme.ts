import { Message } from "my-raft-core";

export const leaderRingColor = 0x434343;
export const electionRingColor = 0xa4a4a4;

export const termColors = [
  0x66c2a5,
  0xfc8d62,
  0x8da0cb,
  0xe78ac3,
  0xa6d854,
  0xffd92f,
];

export const backgroundColor = 0xdde0e4;

export const getMessageColor = (message: Message) => {
  switch (message.type) {
    case "RequestVoteRequest":
    case "RequestVoteResponse":
      return 0x66c2a5;
    case "AppendEntriesRequest":
    case "AppendEntriesResponse":
      return 0xfc8d62;
    default:
      return 0x000;
  }
};
