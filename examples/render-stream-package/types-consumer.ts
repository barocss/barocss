import {
  createCompiler, createCompiledResponse, createJsonlDecoder,
  type OutputRecord, type StreamIdentity,
} from '@barocss/render-stream';

const identity: StreamIdentity = { streamId: 'types-consumer', revision: 1 };
const contract = { textBindings: ['/name'], actions: ['save'] };
const compiler = createCompiler({ identity, contract });
const decoder = createJsonlDecoder({ identity, kind: 'output', onRecord(record: OutputRecord) {
  const css: string = record.css;
  void css;
} });
const response: Response = createCompiledResponse({ identity, contract,
  async *source() { yield new Uint8Array(); },
  acceptFinal(record) { return record.phase === 'committed'; },
});
void [compiler, decoder, response];
