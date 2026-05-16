import snapshotHandler from './snapshot.js';

export default async function handler(request, response) {
  return snapshotHandler(request, response);
}
