from __future__ import division, print_function, absolute_import
import datetime
import os
import pytest

import asyncio

import base
import taskcluster.aio.auth as subjectAsync

pytestmark = [
    pytest.mark.skipif(os.environ.get("NO_TESTS_OVER_WIRE"), reason="Skipping tests over wire")
]


def test_async_works_with_permanent_credentials():
    """we can call methods which require authentication with valid
    permacreds"""

    loop = asyncio.get_event_loop()

    async def x():
        async with subjectAsync.createSession(loop=loop) as session:
            client = subjectAsync.Auth({
                'rootUrl': base.REAL_ROOT_URL,
                'credentials': {
                    'clientId': 'tester',
                    'accessToken': 'no-secret',
                },
            }, session=session)
            result = await client.testAuthenticate({
                'clientScopes': ['test:a'],
                'requiredScopes': ['test:a'],
            })
            assert result == {'scopes': ['test:a'], 'clientId': 'tester'}

    loop.run_until_complete(x())


def test_async_works_with_temporary_credentials():
    """we can call methods which require authentication with temporary
    credentials generated by python client"""
    loop = asyncio.get_event_loop()

    async def x():
        async with subjectAsync.createSession(loop=loop) as session:
            tempCred = subjectAsync.createTemporaryCredentials(
                'tester',
                'no-secret',
                datetime.datetime.utcnow(),
                datetime.datetime.utcnow() + datetime.timedelta(hours=1),
                ['test:xyz'],
            )
            client = subjectAsync.Auth({
                'rootUrl': base.REAL_ROOT_URL,
                'credentials': tempCred,
            }, session=session)

            result = await client.testAuthenticate({
                'clientScopes': ['test:*'],
                'requiredScopes': ['test:xyz'],
            })
            assert result == {'scopes': ['test:xyz'], 'clientId': 'tester'}

    loop.run_until_complete(x())
