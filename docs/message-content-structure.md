给大模型发送消息历史，大模型需要的消息主要有 `role`, `content` 字段，此外还可能有 `tool_calls` 和 `tool_call_id` 字段，详见 https://api-docs.deepseek.com/api/create-chat-completion/

举个例子：

```json
{
  "messages": [
    {
      "role": "system",
      "content": "你是一个友好的中文助手。请用中文回复用户。"
    },
    {
      "role": "user",
      "content": "你好，我刚开始一个新的对话。请用友好的方式问候我，询问我最近在忙什么或者我的状态，但不要让你的回复看起来像是在回答我的问题。"
    },
    {
      "role": "assistant",
      "content": "嘿 X 哥！最近在忙啥呢？"
    },
    {
      "role": "user",
      "content": "在写 AI 任务管理系统。另外请叫我齐天大圣。"
    },
    {
      "role": "assistant",
      "content": "",
      "tool_calls": [
          {
              "index": 0,
              "id": "call_0_9dk2dl8a-202d-dkw3-223d-dk0dk29dm398",
              "type": "function",
              "function": {
                  "name": "create_task",
                  "arguments": "{\"title\":\"写 AI 任务管理系统\"}"
              }
          },
          {
              "index": 1,
              "id": "call_0_32ed5a8c-151b-4f04-8020-a1823627c099",
              "type": "function",
              "function": {
                  "name": "set_nickname",
                  "arguments": "{\"nickname\":\"齐天大圣\"}"
              }
          }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_0_9dk2dl8a-202d-dkw3-223d-dk0dk29dm398",
      "content": "{\"success\":true}"
    },
    {
      "role": "tool",
      "tool_call_id": "call_0_32ed5a8c-151b-4f04-8020-a1823627c099",
      "content": "{\"success\":true}"
    }
  ]
}
```

上面这个例子包含了已知各种类型的大模型消息。

实际上有三种消息结构：
1. 存储在数据库的
2. 用于显示会话内容的
3. 用于发送给大模型的

第一种消息结构需要能够转换为第二种和第三种消息，反之亦然，所以如何设计第一种（也就是存储在数据库的）消息结构就很重要了。

需要注意的是，所有的消息都会存储在数据库中。有些消息会作为消息历史发送给大模型，但不会显示在会话中，例如第一条用户消息；有些消息会显示在会话中，但不会发送给大模型，例如某种系统提示消息。
