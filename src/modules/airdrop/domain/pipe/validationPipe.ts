import { iterate } from 'iterare';
import { types } from 'util';
import { ClassTransformOptions } from "@nestjs/common/interfaces/external/class-transform-options.interface";
import { ValidatorPackage } from "@nestjs/common/interfaces/external/validator-package.interface";
import { TransformerPackage } from "@nestjs/common/interfaces/external/transformer-package.interface";
import { ArgumentMetadata, HttpStatus, Injectable, Optional, PipeTransform, Type } from "@nestjs/common";
import { ValidationError } from "class-validator/types/validation/ValidationError";
import { ErrorHttpStatusCode, HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
import { ValidatorOptions } from "@nestjs/common/interfaces/external/validator-options.interface";
import { loadPackage } from "@nestjs/common/utils/load-package.util";
import { isNil } from "@nestjs/common/utils/shared.utils";
import { SocialLivelyCreateDto } from "../dto/socialLivelyCreate.dto";
import { SocialType } from "../../../profile/domain/entity/socialProfile.entity";
import { SocialLivelyUpdateDto } from "../dto/socialLivelyUpdate.dto";

export enum ContextType {
  CREATE,
  UPDATE
}

export interface ValidationPipeOptions extends ValidatorOptions {
  transform?: boolean;
  disableErrorMessages?: boolean;
  transformOptions?: ClassTransformOptions;
  errorHttpStatusCode?: ErrorHttpStatusCode;
  exceptionFactory?: (errors: ValidationError[]) => any;
  validateCustomDecorators?: boolean;
  expectedType?: Type<any>;
  validatorPackage?: ValidatorPackage;
  transformerPackage?: TransformerPackage;
  validationContext?: ContextType;
}

let classValidator: ValidatorPackage = {} as any;
let classTransformer: TransformerPackage = {} as any;

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  protected isTransformEnabled: boolean;
  protected isDetailedOutputDisabled?: boolean;
  protected validatorOptions: ValidatorOptions;
  protected transformOptions: ClassTransformOptions;
  protected errorHttpStatusCode: ErrorHttpStatusCode;
  protected expectedType: Type<any>;
  protected exceptionFactory: (errors: ValidationError[]) => any;
  protected validateCustomDecorators: boolean;
  protected validationContext?: ContextType;

  constructor(@Optional() options?: ValidationPipeOptions) {
    options = options || {};
    const {
      transform,
      disableErrorMessages,
      errorHttpStatusCode,
      expectedType,
      transformOptions,
      validateCustomDecorators,
      validationContext,
      ...validatorOptions
    } = options;

    this.isTransformEnabled = !!transform;
    this.validatorOptions = validatorOptions;
    this.transformOptions = transformOptions;
    this.isDetailedOutputDisabled = disableErrorMessages;
    this.validateCustomDecorators = validateCustomDecorators || false;
    this.errorHttpStatusCode = errorHttpStatusCode || HttpStatus.BAD_REQUEST;
    this.expectedType = expectedType;
    this.validationContext = validationContext;
    this.exceptionFactory =
      options.exceptionFactory || this.createExceptionFactory();

    classValidator = this.loadValidator(options.validatorPackage);
    classTransformer = this.loadTransformer(options.transformerPackage);
  }

  protected loadValidator(
    validatorPackage?: ValidatorPackage,
  ): ValidatorPackage {
    return (
      validatorPackage ??
      loadPackage('class-validator', 'ValidationPipe', () =>
        require('class-validator'),
      )
    );
  }

  protected loadTransformer(
    transformerPackage?: TransformerPackage,
  ): TransformerPackage {
    return (
      transformerPackage ??
      loadPackage('class-transformer', 'ValidationPipe', () =>
        require('class-transformer'),
      )
    );
  }

  public async transform(value: any, metadata: ArgumentMetadata) {
    if (this.expectedType) {
      metadata = { ...metadata, metatype: this.expectedType };
    }

    const metatype = metadata.metatype;
    if (!metatype || !this.toValidate(metadata)) {
      return this.isTransformEnabled
        ? this.transformPrimitive(value, metadata)
        : value;
    }
    const originalValue = value;
    value = this.toEmptyIfNil(value);

    const isNil = value !== originalValue;
    const isPrimitive = this.isPrimitive(value);
    this.stripProtoKeys(value);
    let entity = classTransformer.plainToClass(
      metatype,
      value,
      this.transformOptions,
    );

    const originalEntity = entity;
    const isCtorNotEqual = entity.constructor !== metatype;

    if (isCtorNotEqual && !isPrimitive) {
      entity.constructor = metatype;
    } else if (isCtorNotEqual) {
      // when "entity" is a primitive value, we have to temporarily
      // replace the entity to perform the validation against the original
      // metatype defined inside the handler
      entity = { constructor: metatype };
    }

    let errors = await this.validate(entity, this.validatorOptions);
    if (errors.length > 0) {
      throw await this.exceptionFactory(errors);
    }

    if (this.validationContext === ContextType.CREATE) {
      errors = this.createValidation(entity);
      if (errors.length > 0) {
        throw await this.exceptionFactory(errors);
      }
    } else if (this.validationContext === ContextType.UPDATE) {
      errors = this.updateValidation(entity);
      if (errors.length > 0) {
        throw await this.exceptionFactory(errors);
      }
    }



    if (isPrimitive) {
      // if the value is a primitive value and the validation process has been successfully completed
      // we have to revert the original value passed through the pipe
      entity = originalEntity;
    }
    if (this.isTransformEnabled) {
      return entity;
    }
    if (isNil) {
      // if the value was originally undefined or null, revert it back
      return originalValue;
    }
    return Object.keys(this.validatorOptions).length > 0
      ? classTransformer.classToPlain(entity, this.transformOptions)
      : value;
  }

  public createExceptionFactory() {
    return (validationErrors: ValidationError[] = []) => {
      if (this.isDetailedOutputDisabled) {
        return new HttpErrorByCode[this.errorHttpStatusCode]();
      }
      // const errors = this.flattenValidationErrors(validationErrors);
      return new HttpErrorByCode[this.errorHttpStatusCode](validationErrors);
    };
  }

  protected toValidate(metadata: ArgumentMetadata): boolean {
    const { metatype, type } = metadata;
    if (type === 'custom' && !this.validateCustomDecorators) {
      return false;
    }
    const types = [String, Boolean, Number, Array, Object, Buffer];
    return !types.some(t => metatype === t) && !isNil(metatype);
  }

  protected transformPrimitive(value: any, metadata: ArgumentMetadata) {
    if (!metadata.data) {
      // leave top-level query/param objects unmodified
      return value;
    }
    const { type, metatype } = metadata;
    if (type !== 'param' && type !== 'query') {
      return value;
    }
    if (metatype === Boolean) {
      return value === true || value === 'true';
    }
    if (metatype === Number) {
      return +value;
    }
    return value;
  }

  protected toEmptyIfNil<T = any, R = any>(value: T): R | {} {
    return isNil(value) ? {} : value;
  }

  protected stripProtoKeys(value: any) {
    if (
      value == null ||
      typeof value !== 'object' ||
      types.isTypedArray(value)
    ) {
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) {
        this.stripProtoKeys(v);
      }
      return;
    }
    delete value.__proto__;
    for (const key in value) {
      this.stripProtoKeys(value[key]);
    }
  }

  protected isPrimitive(value: unknown): boolean {
    return ['number', 'boolean', 'string'].includes(typeof value);
  }

  protected validate(
    object: object,
    validatorOptions?: ValidatorOptions,
  ): Promise<ValidationError[]> | ValidationError[] {
    return classValidator.validate(object, validatorOptions);
  }

  protected flattenValidationErrors(
    validationErrors: ValidationError[],
  ): string[] {
    return iterate(validationErrors)
      .map(error => this.mapChildrenToValidationErrors(error))
      .flatten()
      .filter(item => !!item.constraints)
      .map(item => Object.values(item.constraints))
      .flatten()
      .toArray();
  }

  protected mapChildrenToValidationErrors(
    error: ValidationError,
    parentPath?: string,
  ): ValidationError[] {
    if (!(error.children && error.children.length)) {
      return [error];
    }
    const validationErrors = [];
    parentPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    for (const item of error.children) {
      if (item.children && item.children.length) {
        validationErrors.push(
          ...this.mapChildrenToValidationErrors(item, parentPath),
        );
      }
      validationErrors.push(
        this.prependConstraintsWithParentProp(parentPath, item),
      );
    }
    return validationErrors;
  }

  protected prependConstraintsWithParentProp(
    parentPath: string,
    error: ValidationError,
  ): ValidationError {
    const constraints = {};
    for (const key in error.constraints) {
      constraints[key] = `${parentPath}.${error.constraints[key]}`;
    }
    return {
      ...error,
      constraints,
    };
  }

  protected createValidation(dto: SocialLivelyCreateDto): ValidationError[] {
    let validations: ValidationError[] = []
    if(dto.socialType === SocialType.TWITTER) {

      if(!dto?.profileName) {
        let validate: ValidationError = {
          target: SocialLivelyCreateDto,
          property: 'profileName',
          value: dto.profileName,
          constraints: {
            profileName: 'Twitter profileName must not empty'
          }
        }
        validations.push(validate);
      }

      if(!dto?.userId) {
        let validate: ValidationError = {
          target: SocialLivelyCreateDto,
          property: 'userId',
          value: dto.userId,
          constraints: {
            userId: 'Twitter userId must not empty'
          }
        }
        validations.push(validate);
      }

      if(!dto?.profileUrl) {
        let validate: ValidationError = {
          target: SocialLivelyCreateDto,
          property: 'profileUrl',
          value: dto.profileUrl,
          constraints: {
            profileUrl: 'Twitter profileUrl must not empty'
          }
        }
        validations.push(validate);
      }
    }
    return validations;
  }

  protected updateValidation(dto: SocialLivelyUpdateDto): ValidationError[] {
    let validations: ValidationError[] = []
    return validations;
  }
}