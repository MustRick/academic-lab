import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

export const checkConnection = async () => {
  const info = await client.info();
  console.log(`Elasticsearch connected: ${info.name} (${info.version.number})`);
  return info;
};

export default client;
