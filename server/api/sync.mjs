import * as blob from '@vercel/blob';
import {validateSnapshot} from '../shared/sync-data.mjs';
import {createSyncHandler} from '../lib/handler.mjs';

// Set NODEJS_HELPERS=0 in each Vercel environment before building this function.
// The handler reads and bounds the raw request stream itself.
export default createSyncHandler({blob,validateSnapshot,tokenHash:process.env.SNOWPACK_TOKEN_HASH});
