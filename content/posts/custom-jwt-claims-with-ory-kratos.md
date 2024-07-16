---
title: "Custom JWT Claims with Ory Kratos"
date: 2024-07-02
draft: false
tags: ["development", "golang", "jwt", "jwk"]
---

[JSON Web Tokens](https://en.wikipedia.org/wiki/JSON_Web_Token) (`JWT`) are data structures that allow the holder of the token to assert `claims` that are able to be cryptographically verified. An example would be that a claim could hold a user `claim` `role` like `administrator` that if proven to be unaltered (using a shared public key) then could be used to provide access to certain `administrator` functions.

Tools like [PostgREST](https://postgrest.org/en/v12/), [Hasura](https://hasura.io/) and [Supabase](https://supabase.com/) (a managed PostgREST) rely on `JWT`s to carry a user's `claims` where the `role` claim is used to [set a Postgres role](https://www.postgresql.org/docs/current/sql-set-role.html) to enforce role-based access control. Tools like [Auth0](https://auth0.com/) and [Supabase Auth](https://github.com/supabase/auth) are tools that are commonly used to generate the `JWT` and can be configured to create tokens that contain the correct `claims` format for the target system.

## Ory Kratos

[Ory Kratos](https://www.ory.sh/kratos/) is part of a suite of products that provide authentication, identity management and permissions with `Kratos` focused on the login/authentication side. `Kratos` supports modern login solutions like [Passkey](https://www.ory.sh/docs/kratos/passwordless/passkeys) alongside the traditional methods, can be self-hosted, is [open-source](https://github.com/ory/kratos), supports many [databases](https://www.ory.sh/docs/self-hosted/deployment##sql-persistent) and can be easily packaged as a [Docker container](https://hub.docker.com/r/oryd/kratos). These benefits mean it is possible to easily start with a [SQLite/Litestream](https://litestream.io/) instance, for example, and migrate to an Ory managed instance if required.

By default, upon `login`, a user will be issued an Ory `Session` object that can be verified by the server (by calling `/session/whoami`) against the `Kratos` instance to validate the user and apply authentication and authorization. To convert this `Session` object into a `JWT` with the correct claims `Kratos` provides a not-so-well documented feature:

## Converting a Session to JWT

`Kratos` is configured using a `kratos.yml` file that contains the configuration for converting the `Session` to `JWT`. Hidden away in this [pull request](https://github.com/ory/kratos/pull/3472) is how to configure it. The idea is that `/session/whoami` can be called with an optional `tokenize_as` parameter thats allows the caller to specify a target token format.

In the below example `tokenize_as` could be set to either `postgrest` or `hasura`. The three values that must be provided are `ttl`, which controls the `exp`iry of the token and  `jwks_url` and `claims_mapper_url` which are described below. Due to the difficulty revoking `JWT`s it is a good idea to keep the `ttl` as low as practical.

```yaml
session:
  whoami:
    tokenizer:
      templates:
        postgrest:
          ttl: 1h
          jwks_url: file:///etc/config/kratos/jwk.eddsa.json
          claims_mapper_url: file:///etc/config/kratos/postgrest.claims.jsonnet
        hasura:
          ttl: 1h
          jwks_url: file:///etc/config/kratos/jwk.eddsa.json
          claims_mapper_url: file:///etc/config/kratos/hasura.claims.jsonnet
```


## jwks_url

To sign the token `Kratos` must be provided a `key` as a JSON Web Key. There are many ways to create such a key but an easy one is to download another Ory product, [Oathkeeper](https://www.ory.sh/oathkeeper/) (binaries are [available on github](https://github.com/ory/oathkeeper/releases)) and run the command:

```bash
oathkeeper credentials generate --alg EdDSA
```

A value like below will be returned which can be saved as `/etc/config/kratos/jwk.eddsa.json` and accessed via the `Kratos` instance.

The `JWK` can easily to passed into [PostgREST](https://postgrest.org/en/v12/references/configuration.html##jwt-secret) via environment variable `PGRST_JWT_SECRET` or [Hasura](https://hasura.io/docs/latest/auth/authentication/jwt/##configure-hasura-jwt-mode) via `HASURA_GRAPHQL_JWT_SECRET` to allow them to verify the `JWT`.

```json
{
  "keys": [
    {
      "use": "sig",
      "kty": "OKP",
      "kid": "10dd524d-decb-48ff-b84d-7d389c10f2f7",
      "crv": "Ed25519",
      "alg": "EdDSA",
      "x": "58zYrqRbmsXkyg2t50S9_RoZQb2cVXnSfxUU4aPhDAk",
      "d": "1F_Thkzgc43ZiI_qqnf1xuNHqN6EPJYgpX5NXm15bb0"
    }
  ]
}
```

## claims_mapper_url

The claims mapper is where a custom configuration can be defined using the [Jsonnet](https://jsonnet.org/) configuration language. The claims for a Hasura endpoint can be configured like:

```jsonnet
local session = std.extVar('session');

{
  "claims": {
    "https://hasura.io/jwt/claims": {
      "x-hasura-default-role": "user",
      "x-hasura-allowed-roles": ["user"],
      "x-hasura-user-id": session.identity.id,
    }
  }
}
```

The much simplier configuration for PostgREST may look like:

```jsonnet
local session = std.extVar('session');

{
  "claims": {
    "role": "user",
    "userId": session.identity.id
  }
}
```