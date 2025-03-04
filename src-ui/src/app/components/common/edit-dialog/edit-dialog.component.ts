import { Directive, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'
import { Observable } from 'rxjs'
import {
  MATCHING_ALGORITHMS,
  MATCH_AUTO,
  MATCH_NONE,
} from 'src/app/data/matching-model'
import { ObjectWithId } from 'src/app/data/object-with-id'
import { ObjectWithPermissions } from 'src/app/data/object-with-permissions'
import { PaperlessUser } from 'src/app/data/paperless-user'
import { AbstractPaperlessService } from 'src/app/services/rest/abstract-paperless-service'
import { UserService } from 'src/app/services/rest/user.service'
import { PermissionsFormObject } from '../input/permissions/permissions-form/permissions-form.component'
import { SettingsService } from 'src/app/services/settings.service'

@Directive()
export abstract class EditDialogComponent<
  T extends ObjectWithPermissions | ObjectWithId
> implements OnInit
{
  constructor(
    protected service: AbstractPaperlessService<T>,
    private activeModal: NgbActiveModal,
    private userService: UserService,
    private settingsService: SettingsService
  ) {}

  users: PaperlessUser[]

  @Input()
  dialogMode: string = 'create'

  @Input()
  object: T

  @Output()
  succeeded = new EventEmitter()

  @Output()
  failed = new EventEmitter()

  networkActive = false

  closeEnabled = false

  error = null

  abstract getForm(): FormGroup

  objectForm: FormGroup = this.getForm()

  ngOnInit(): void {
    if (this.object != null) {
      if (this.object['permissions']) {
        this.object['set_permissions'] = this.object['permissions']
      }

      this.object['permissions_form'] = {
        owner: (this.object as ObjectWithPermissions).owner,
        set_permissions: (this.object as ObjectWithPermissions).permissions,
      }
      this.objectForm.patchValue(this.object)
    }

    // wait to enable close button so it doesnt steal focus from input since its the first clickable element in the DOM
    setTimeout(() => {
      this.closeEnabled = true
    })

    this.userService.listAll().subscribe((r) => {
      this.users = r.results
      if (this.dialogMode === 'create') {
        this.objectForm.get('permissions_form')?.setValue({
          owner: this.settingsService.currentUser.id,
        })
      }
    })
  }

  getCreateTitle() {
    return $localize`Create new item`
  }

  getEditTitle() {
    return $localize`Edit item`
  }

  getSaveErrorMessage(error: string) {
    return $localize`Could not save element: ${error}`
  }

  getTitle() {
    switch (this.dialogMode) {
      case 'create':
        return this.getCreateTitle()
      case 'edit':
        return this.getEditTitle()
      default:
        break
    }
  }

  getMatchingAlgorithms() {
    return MATCHING_ALGORITHMS
  }

  get patternRequired(): boolean {
    return (
      this.objectForm?.value.matching_algorithm !== MATCH_AUTO &&
      this.objectForm?.value.matching_algorithm !== MATCH_NONE
    )
  }

  save() {
    this.error = null
    const formValues = Object.assign({}, this.objectForm.value)
    const permissionsObject: PermissionsFormObject =
      this.objectForm.get('permissions_form')?.value
    if (permissionsObject) {
      formValues.owner = permissionsObject.owner
      formValues.set_permissions = permissionsObject.set_permissions
      delete formValues.permissions_form
    }

    var newObject = Object.assign(Object.assign({}, this.object), formValues)
    var serverResponse: Observable<T>
    switch (this.dialogMode) {
      case 'create':
        serverResponse = this.service.create(newObject)
        break
      case 'edit':
        serverResponse = this.service.update(newObject)
      default:
        break
    }
    this.networkActive = true
    serverResponse.subscribe({
      next: (result) => {
        this.activeModal.close()
        this.succeeded.emit(result)
      },
      error: (error) => {
        this.error = error.error
        this.networkActive = false
        this.failed.next(error)
      },
    })
  }

  cancel() {
    this.activeModal.close()
  }
}
