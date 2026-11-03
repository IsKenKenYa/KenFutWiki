/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import httpRequest, { ContentType, RequestParams } from "./httpClient";
import {
  DomainResponse,
  DomainStorageSetting,
  DomainStorageSettingDetail,
  DomainStorageTestResult,
} from "./types";

/**
 * @description get current effective storage setting (secret masked) and client status
 *
 * @tags storage
 * @name GetApiV1StorageSetting
 * @summary get storage setting
 * @request GET:/api/v1/storage/setting
 * @response `200` `(DomainResponse & {
    data?: DomainStorageSettingDetail,

})` OK
 */

export const getApiV1StorageSetting = (params: RequestParams = {}) =>
  httpRequest<
    DomainResponse & {
      data?: DomainStorageSettingDetail;
    }
  >({
    path: `/api/v1/storage/setting`,
    method: "GET",
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description validate, save storage setting and rebuild client; empty or masked secret keeps current value
 *
 * @tags storage
 * @name PostApiV1StorageSetting
 * @summary update storage setting
 * @request POST:/api/v1/storage/setting
 * @response `200` `(DomainResponse & {
    data?: DomainStorageSettingDetail,

})` OK
 */

export const postApiV1StorageSetting = (
  request: DomainStorageSetting,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainResponse & {
      data?: DomainStorageSettingDetail;
    }
  >({
    path: `/api/v1/storage/setting`,
    method: "POST",
    body: request,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description delete saved storage setting and fall back to env default
 *
 * @tags storage
 * @name DeleteApiV1StorageSetting
 * @summary reset storage setting
 * @request DELETE:/api/v1/storage/setting
 * @response `200` `DomainResponse` OK
 */

export const deleteApiV1StorageSetting = (params: RequestParams = {}) =>
  httpRequest<DomainResponse>({
    path: `/api/v1/storage/setting`,
    method: "DELETE",
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description probe storage connectivity with the given setting without saving
 *
 * @tags storage
 * @name PostApiV1StorageTest
 * @summary test storage connection
 * @request POST:/api/v1/storage/test
 * @response `200` `(DomainResponse & {
    data?: DomainStorageTestResult,

})` OK
 */

export const postApiV1StorageTest = (
  request: DomainStorageSetting,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainResponse & {
      data?: DomainStorageTestResult;
    }
  >({
    path: `/api/v1/storage/test`,
    method: "POST",
    body: request,
    type: ContentType.Json,
    format: "json",
    ...params,
  });
