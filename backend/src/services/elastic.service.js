import { Client } from '@elastic/elasticsearch'

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
})

export const searchDocuments = async (index, query, size = 10) => {
  const result = await client.search({ index, query, size })
  return result.hits.hits.map((hit) => ({
    id: hit._id,
    score: hit._score,
    ...hit._source,
  }))
}

export const indexDocument = async (index, id, document) => {
  return client.index({ index, id, document })
}

export default client
