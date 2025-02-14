import fetch from 'node-fetch';

export type ClientConfiguration = {
    tenantIdentifier: string;
    tenantId?: string;
    accessTokenId?: string;
    accessTokenSecret?: string;
};

export type VariablesType = Record<string, any>;
export type ApiCaller<T> = (query: string, variables?: VariablesType) => Promise<T>;

export type ClientInterface = {
    catalogueApi: ApiCaller<any>;
    searchApi: ApiCaller<any>;
    orderApi: ApiCaller<any>;
    subscriptionApi: ApiCaller<any>;
    pimApi: ApiCaller<any>;
    config: ClientConfiguration;
};

async function post<T>(
    path: string,
    config: ClientConfiguration,
    query: string,
    variables?: VariablesType,
    init?: RequestInit | any | undefined,
): Promise<T> {
    try {
        const response = await fetch(path, {
            ...init,
            method: 'POST',
            headers: {
                'Content-type': 'application/json; charset=UTF-8',
                Accept: 'application/json',
                'X-Crystallize-Access-Token-Id': config.accessTokenId || '',
                'X-Crystallize-Access-Token-Secret': config.accessTokenSecret || '',
            },
            body: JSON.stringify({ query, variables }),
        });

        if (response.ok && 204 === response.status) {
            return <T>{};
        }
        if (!response.ok) {
            const json = await response.json();
            throw {
                code: response.status,
                statusText: response.statusText,
                message: json.message,
                errors: json.errors || {},
            };
        }
        // we still need to check for error as the API can return 200 with errors
        const json = await response.json();
        if (json.errors) {
            throw {
                code: 400,
                statusText: 'Error was returned from the API',
                message: json.errors[0].message,
                errors: json.errors || {},
            };
        }

        return <T>json.data;
    } catch (exception) {
        throw exception;
    }
}

function createApiCaller(uri: string, configuration: ClientConfiguration): ApiCaller<any> {
    /**
     * Call a crystallize. Will automatically handle access tokens
     * @param query The GraphQL query
     * @param variables Variables to inject into query.
     */
    return function callApi<T>(query: string, variables?: VariablesType): Promise<T> {
        return post<T>(uri, configuration, query, variables);
    };
}

const apiHost = (path: string[], prefix: 'api' | 'pim' = 'api') =>
    `https://${prefix}.crystallize.com/${path.join('/')}`;

/**
 * Create one api client for each api endpoint Crystallize offers (catalogue, search, order, subscription, pim).
 *
 * @param configuration
 * @returns ClientInterface
 */
export function createClient(configuration: ClientConfiguration): ClientInterface {
    const identifier = configuration.tenantIdentifier;

    return {
        catalogueApi: createApiCaller(apiHost([identifier, 'catalogue']), configuration),
        searchApi: createApiCaller(apiHost([identifier, 'search']), configuration),
        orderApi: createApiCaller(apiHost([identifier, 'orders']), configuration),
        subscriptionApi: createApiCaller(apiHost([identifier, 'subscriptions']), configuration),
        pimApi: createApiCaller(apiHost(['graphql'], 'pim'), configuration),
        config: configuration,
    };
}
