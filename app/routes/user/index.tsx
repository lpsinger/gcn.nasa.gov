/*!
 * Copyright © 2022 United States Government as represented by the Administrator
 * of the National Aeronautics and Space Administration. No copyright is claimed
 * in the United States under Title 17, U.S. Code. All Other Rights Reserved.
 *
 * SPDX-License-Identifier: NASA-1.3
 */
import { UpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider'
import type { DataFunctionArgs } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import {
  Button,
  Fieldset,
  Icon,
  Label,
  TextInput,
} from '@trussworks/react-uswds'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useId } from 'react'

import { storage } from '../__auth/auth.server'
import { getUser, updateSession } from '../__auth/user.server'
import { formatAuthor } from '../circulars/circulars.lib'
import { client, maybeThrow } from './cognito.server'
import Hint from '~/components/Hint'
import Spinner from '~/components/Spinner'
import { getFormDataString } from '~/lib/utils'

export const handle = { breadcrumb: 'Profile', getSitemapEntries: () => null }

export async function loader({ request }: DataFunctionArgs) {
  const user = await getUser(request)
  if (!user) throw new Response(null, { status: 403 })

  const { email, idp, givenName, middleName, familyName, affiliation } = user
  return { email, idp, givenName, middleName, familyName, affiliation }
}

export async function action({ request }: DataFunctionArgs) {
  const user = await getUser(request)
  if (!user) throw new Response(null, { status: 403 })

  const [session, data] = await Promise.all([
    storage.getSession(request.headers.get('Cookie')),
    request.formData(),
  ])
  const givenName = getFormDataString(data, 'givenName')
  const middleName = getFormDataString(data, 'middleName')
  const familyName = getFormDataString(data, 'familyName')
  const affiliation = getFormDataString(data, 'affiliation')

  const command = new UpdateUserAttributesCommand({
    UserAttributes: [
      {
        Name: 'given_name',
        Value: givenName,
      },
      {
        Name: 'middle_name',
        Value: middleName,
      },
      {
        Name: 'family_name',
        Value: familyName,
      },
      {
        Name: 'custom:affiliation',
        Value: affiliation,
      },
    ],
    AccessToken: session.get('accessToken'),
  })

  try {
    await client.send(command)
  } catch (e) {
    maybeThrow(e, 'not saving name and affiliation permanently')
  }

  user.givenName = givenName
  user.middleName = middleName
  user.familyName = familyName
  user.affiliation = affiliation
  await updateSession({ user }, session)
  return null
}

function AccessibleTextInput({
  label,
  hint,
  ...props
}: { label: ReactNode; hint: ReactNode } & Omit<
  Parameters<typeof TextInput>[0],
  'id' | 'aria-describedby'
>) {
  const hintId = useId()
  const inputId = useId()
  return (
    <>
      <Label htmlFor={inputId}>{label}</Label>
      <Hint id={hintId}>{hint}</Hint>
      <TextInput id={inputId} aria-describedby={hintId} {...props} />
    </>
  )
}

export default function () {
  const { email, givenName, middleName, familyName, affiliation } =
    useLoaderData<typeof loader>()
  const fetcher = useFetcher<typeof action>()
  const [dirty, setDirty] = useState(false)
  const [currentGivenName, setCurrentGivenName] = useState(givenName)
  const [currentMiddleName, setCurrentMiddleName] = useState(middleName)
  const [currentFamilyName, setCurrentFamilyName] = useState(familyName)
  const [currentAffiliation, setCurrentAffiliation] = useState(affiliation)
  const disabled = fetcher.state !== 'idle'

  return (
    <>
      <h1>Profile</h1>
      <fetcher.Form method="POST" onSubmit={() => setDirty(false)}>
        <p className="usa-paragraph">
          Your profile affects how your name appears in GCN Circulars that you
          submit and in bibliographic entries for GCN Circulars.
        </p>
        <Fieldset>
          <h2>Name</h2>
          <AccessibleTextInput
            label="First or given name"
            hint="For example: Jose, Darren, or Mai"
            name="givenName"
            type="text"
            autoComplete="given-name"
            defaultValue={givenName}
            disabled={disabled}
            onChange={(e) => {
              setDirty(true)
              setCurrentGivenName(e.target.value)
            }}
          />
          <AccessibleTextInput
            label="Middle name or initial"
            hint="For example: Lynn or L."
            name="middleName"
            type="text"
            autoComplete="additional-name"
            defaultValue={middleName}
            disabled={disabled}
            onChange={(e) => {
              setDirty(true)
              setCurrentMiddleName(e.target.value)
            }}
          />
          <AccessibleTextInput
            label="Last or family name"
            hint="For example: Martinez Gonzalez, Gu, or Smith"
            name="familyName"
            type="text"
            autoComplete="family-name"
            defaultValue={familyName}
            disabled={disabled}
            onChange={(e) => {
              setDirty(true)
              setCurrentFamilyName(e.target.value)
            }}
          />
        </Fieldset>
        <AccessibleTextInput
          label="Affiliation"
          hint="For example: For example: Pennsylvania State University, Ioffe Institute, DESY, Fermi-GBM Team, or AAVSO"
          name="affiliation"
          type="text"
          defaultValue={affiliation}
          disabled={disabled}
          onChange={(e) => {
            setDirty(true)
            setCurrentAffiliation(e.target.value)
          }}
        />
        <Fieldset>
          <h2>Preview</h2>
          <Label htmlFor="preview">Circulars submitter</Label>
          <Hint id="previewHint">
            This is how the "From" field will be shown in GCN Circulars that you
            submit.
          </Hint>
          <div aria-describedby="previewHint" id="preview">
            {formatAuthor({
              name:
                [currentGivenName, currentMiddleName, currentFamilyName]
                  .filter(Boolean)
                  .join(' ') || undefined,
              affiliation: currentAffiliation,
              email,
            })}
          </div>
          <Label htmlFor="biblio">Bibilography</Label>
          <Hint id="biblioHint">
            This is how your name will appear when Circulars by you are cited in
            bibliographies.
          </Hint>
          <div aria-describedby="biblioHint" id="biblio">
            {currentFamilyName}, {currentGivenName} {currentMiddleName}
          </div>
        </Fieldset>
        <Button
          className="usa-button margin-top-2"
          type="submit"
          disabled={disabled}
        >
          Save
        </Button>
        {fetcher.state !== 'idle' && (
          <>
            <Spinner /> Saving...
          </>
        )}
        {fetcher.type === 'done' && !dirty && (
          <>
            <Icon.Check color="green" /> Saved
          </>
        )}
      </fetcher.Form>
    </>
  )
}
