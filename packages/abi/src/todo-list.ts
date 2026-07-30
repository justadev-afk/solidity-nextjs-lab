// Hand-written to mirror `ITodoList` exactly, so apps/web typechecks before the exercise
// contract compiles. `bun run abi:sync` overwrites it with the real artifact
// (packages/contracts/out/TodoList.sol/TodoList.json) once TodoList.sol is implemented — the
// generated ABI is a superset, adding the MAX_CONTENT_LENGTH / MAX_TASKS_PER_OWNER getters.
// If you change ITodoList.sol, change this file in the same commit.

export const todoListAbi = [
  {
    type: "function",
    name: "clearCompleted",
    inputs: [],
    outputs: [
      {
        name: "removed",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "completedCount",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createTask",
    inputs: [
      {
        name: "content",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deleteTask",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getTask",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct ITodoList.Task",
        components: [
          {
            name: "id",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "content",
            type: "string",
            internalType: "string",
          },
          {
            name: "completed",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "createdAt",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "updatedAt",
            type: "uint64",
            internalType: "uint64",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTasks",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ITodoList.Task[]",
        components: [
          {
            name: "id",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "content",
            type: "string",
            internalType: "string",
          },
          {
            name: "completed",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "createdAt",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "updatedAt",
            type: "uint64",
            internalType: "uint64",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTasksPaged",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "offset",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "limit",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ITodoList.Task[]",
        components: [
          {
            name: "id",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "content",
            type: "string",
            internalType: "string",
          },
          {
            name: "completed",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "createdAt",
            type: "uint64",
            internalType: "uint64",
          },
          {
            name: "updatedAt",
            type: "uint64",
            internalType: "uint64",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasTask",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextTaskId",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "taskCount",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "toggleTask",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "completed",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateTask",
    inputs: [
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "content",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "CompletedCleared",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "removed",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TaskCreated",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "content",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "createdAt",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TaskDeleted",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TaskToggled",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "completed",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
      {
        name: "updatedAt",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TaskUpdated",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "content",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "updatedAt",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "ContentTooLong",
    inputs: [
      {
        name: "length",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "maxLength",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "EmptyContent",
    inputs: [],
  },
  {
    type: "error",
    name: "OffsetOutOfRange",
    inputs: [
      {
        name: "offset",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "taskCount",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "TaskLimitReached",
    inputs: [
      {
        name: "limit",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "error",
    name: "TaskNotFound",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "id",
        type: "uint256",
        internalType: "uint256",
      },
    ],
  },
] as const;

export type TodoListAbi = typeof todoListAbi;
