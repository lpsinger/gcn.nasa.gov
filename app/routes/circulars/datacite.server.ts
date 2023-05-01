/*!
 * Copyright © 2022 United States Government as represented by the Administrator
 * of the National Aeronautics and Space Administration. No copyright is claimed
 * in the United States under Title 17, U.S. Code. All Other Rights Reserved.
 *
 * SPDX-License-Identifier: NASA-1.3
 */
import type { components } from '@nasa-gcn/datacite-api-types'

import { type Circular, formatDateISO } from './circulars.lib'
import {
  getEnvOrDie,
  getEnvOrDieInProduction,
  getOrigin,
} from '~/lib/env.server'
import { getBasicAuthHeaders } from '~/lib/headers.server'

function getApiURL() {
  return (
    getEnvOrDieInProduction('DATACITE_API_URL') ||
    'https://api.test.datacite.org'
  )
}

export function getPrefix() {
  return getEnvOrDieInProduction('DATACITE_PREFIX') || '10.xxxxx'
}

export function getHandleURL() {
  return (
    getEnvOrDieInProduction('DATACITE_HANDLE_URL') ||
    'https://handle.stage.datacite.org'
  )
}

export async function register({
  circularId,
  createdOn,
  submitter,
  subject,
}: Circular) {
  const apiURL = getApiURL()
  const username = getEnvOrDie('DATACITE_REPOSITORY_ID')
  const password = getEnvOrDie('DATACITE_PASSWORD')
  const origin = getOrigin()
  const prefix = getPrefix()
  const volume = circularId.toString()
  const doi = `${prefix}/${volume}`

  const body: components['schemas']['Doi'] = {
    data: {
      type: 'dois',
      attributes: {
        doi,
        prefix,
        suffix: volume,
        event: 'publish',
        url: `${origin}/circulars/${circularId}`,
        dates: [{ date: formatDateISO(createdOn), dateType: 'Created' }],
        publisher: 'NASA',
        publicationYear: new Date(createdOn).getUTCFullYear(),
        creators: [{ name: submitter }],
        titles: [{ title: subject }],
        types: { resourceTypeGeneral: 'JournalArticle' },
        container: { volume, title: 'GCN Circulars' },
      },
    },
  }

  const response = await fetch(`${apiURL}/dois/${doi}`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/vnd.api+json',
      ...getBasicAuthHeaders(username, password),
    },
    method: 'PUT',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `DataCite API call failed with status ${response.status} and text ${text}`
    )
  }
}
